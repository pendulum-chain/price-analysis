import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";

const API_URL = 'https://api.binance.com/api/v3/depth';
const SYMBOLS_TO_FETCH = [
    {apiSymbol: 'USDTBRL', pair: 'USDT-BRL'},
    {apiSymbol: 'EURUSDC', pair: 'EUR-USDC'},
];
const AMOUNTS = [1000, 10000, 100000];

interface OrderBook {
    lastUpdateId: number;
    bids: [string, string][];
    asks: [string, string][];
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
            const response = await fetch(`${API_URL}?symbol=${apiSymbol}&limit=1000`);
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

    const resultsBySymbol = await Promise.all(fetchPromises);

    // Flatten the array of arrays into a single array
    return resultsBySymbol.flat();
}
