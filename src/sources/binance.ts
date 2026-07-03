import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";
import {AMOUNTS} from "../index.ts";
import {buildSpotRows} from '../utils/price-math.ts';

const DEPTH_API_URL = 'https://api.binance.com/api/v3/depth';
const EXCHANGE_INFO_API_URL = 'https://api.binance.com/api/v3/exchangeInfo';
const BOOK_TICKER_API_URL = 'https://api.binance.com/api/v3/ticker/bookTicker';
const SYMBOLS_TO_FETCH = [
    {apiSymbol: 'EURUSDC', pair: 'EUR-USDC'},
];

// USDT/BRL is Binance's core OTC reference for the Brazilian real; we focus on
// it rather than USDC/BRL. Kept as a list so additional fallbacks can be added.
const BRL_REFERENCE_SYMBOLS = [
    {apiSymbol: 'USDTBRL', pair: 'USDT-BRL'},
];

interface OrderBook {
    lastUpdateId: number;
    bids: [string, string][];
    asks: [string, string][];
}

interface BinanceExchangeInfoResponse {
    symbols: Array<{
        status: string;
        isSpotTradingAllowed: boolean;
    }>;
}

interface BinanceBookTickerResponse {
    symbol: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
}

async function isTradableSpotSymbol(apiSymbol: string): Promise<boolean> {
    const url = new URL(EXCHANGE_INFO_API_URL);
    url.searchParams.set('symbol', apiSymbol);

    const response = await fetch(url.toString());
    if (!response.ok) {
        return false;
    }

    const data = (await response.json()) as BinanceExchangeInfoResponse;
    const symbol = data.symbols[0];

    return symbol?.status === 'TRADING' && symbol.isSpotTradingAllowed;
}

async function fetchBookTickerMidpoint(apiSymbol: string): Promise<number | undefined> {
    const url = new URL(BOOK_TICKER_API_URL);
    url.searchParams.set('symbol', apiSymbol);

    const response = await fetch(url.toString());
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch Binance book ticker for ${apiSymbol}: ${response.status} ${response.statusText} - ${errorText}`);
        return undefined;
    }

    const data = (await response.json()) as BinanceBookTickerResponse;
    const bid = parseFloat(data.bidPrice);
    const ask = parseFloat(data.askPrice);

    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
        console.error(`Invalid Binance book ticker for ${apiSymbol}: bid=${data.bidPrice}, ask=${data.askPrice}`);
        return undefined;
    }

    return (bid + ask) / 2;
}

async function getBinanceBrlReferencePrice(timestamp: Date): Promise<PriceDataAttributes[]> {
    for (const {apiSymbol, pair} of BRL_REFERENCE_SYMBOLS) {
        try {
            if (!await isTradableSpotSymbol(apiSymbol)) {
                console.warn(`Binance symbol ${apiSymbol} is not available for spot trading. Trying fallback if configured.`);
                continue;
            }

            const rate = await fetchBookTickerMidpoint(apiSymbol);
            if (rate === undefined) {
                continue;
            }

            return buildSpotRows({
                amounts: AMOUNTS,
                currencyPair: pair,
                rate,
                source: 'Binance',
                timestamp,
            });
        } catch (error) {
            console.error(`Error fetching Binance BRL reference for ${apiSymbol}:`, error);
        }
    }

    return [];
}

/**
 * Calculates the effective exchange rate for a given amount from the order book asks.
 * @param asks The asks from the order book [price, quantity].
 * @param targetAmount The amount of the base asset to buy.
 * @returns The effective exchange rate.
 */
function calculateEffectiveRate(asks: [string, string][], targetAmount: number): number {
    let totalCost = 0;
    let amountFilled = 0;

    for (const [priceStr, quantityStr] of asks) {
        const price = parseFloat(priceStr);
        const quantity = parseFloat(quantityStr);

        if (amountFilled >= targetAmount) {
            break;
        }

        const amountToFill = targetAmount - amountFilled;

        if (quantity >= amountToFill) {
            totalCost += amountToFill * price;
            amountFilled += amountToFill;
        } else {
            totalCost += quantity * price;
            amountFilled += quantity;
        }
    }

    if (amountFilled < targetAmount) {
        // Not enough liquidity in the provided order book depth to fill the order
        console.warn(`Not enough liquidity to fill an order of ${targetAmount} for ${asks[0]}. Only ${amountFilled} was filled.`);
        return Infinity;
    }

    return totalCost / amountFilled;
}

/**
 * Fetches exchange rates from Binance for specified currency pairs and amounts.
 * @returns A promise that resolves to an array of price data.
 */
export async function getBinancePrice(): Promise<PriceDataAttributes[]> {
    const timestamp = new Date();

    const fetchPromises = SYMBOLS_TO_FETCH.map(async ({apiSymbol, pair}) => {
        try {
            const response = await fetch(`${DEPTH_API_URL}?symbol=${apiSymbol}&limit=1000`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch data for ${apiSymbol}: ${response.status} ${response.statusText} - ${errorText}`);
                return [];
            }
            const orderBook = (await response.json()) as OrderBook;
            const resultsForSymbol: PriceDataAttributes[] = [];

            for (const amount of AMOUNTS) {
                const rate = calculateEffectiveRate(orderBook.asks, amount);
                if (rate !== Infinity) {
                    resultsForSymbol.push({
                        id: generateUUID(),
                        timestamp,
                        source: 'Binance',
                        currency_pair: pair,
                        amount: amount,
                        rate: rate,
                    });
                }
            }
            return resultsForSymbol;
        } catch (error) {
            console.error(`Error fetching or processing data for ${apiSymbol}:`, error);
            return [];
        }
    });

    const resultsBySymbol = await Promise.all([
        getBinanceBrlReferencePrice(timestamp),
        ...fetchPromises,
    ]);

    // Flatten the array of arrays into a single array
    return resultsBySymbol.flat();
}
