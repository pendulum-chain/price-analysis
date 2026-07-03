import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";
import {AMOUNTS} from "../index.ts";
import {buildSpotRows} from '../utils/price-math.ts';

const API_URL = 'https://api.coinbase.com/v2/prices';
const EXCHANGE_API_URL = 'https://api.exchange.coinbase.com/products';
const PAIRS_TO_FETCH = [
    'EURC-USD',
    'USDC-USD',
    'BRL-USD',
];
const EXCHANGE_PAIRS_TO_FETCH = [
    'EURC-USDC',
];

interface CoinbaseResponse {
    data: {
        amount: string;
        base: string;
        currency: string;
    };
}

interface CoinbaseExchangeTickerResponse {
    price: string;
    bid: string;
    ask: string;
    volume: string;
    time?: string;
}

async function getCoinbaseExchangeTickerPrice(pair: string, timestamp: Date): Promise<PriceDataAttributes[]> {
    try {
        const response = await fetch(`${EXCHANGE_API_URL}/${pair}/ticker`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch Coinbase Exchange ticker for ${pair}: ${response.status} ${response.statusText} - ${errorText}`);
            return [];
        }

        const data = (await response.json()) as CoinbaseExchangeTickerResponse;
        const rate = parseFloat(data.price);

        if (!Number.isFinite(rate)) {
            console.error(`Invalid Coinbase Exchange ticker rate for ${pair}: ${data.price}`);
            return [];
        }

        return buildSpotRows({
            amounts: AMOUNTS,
            currencyPair: pair,
            rate,
            source: 'Coinbase',
            timestamp: data.time ? new Date(data.time) : timestamp,
        });
    } catch (error) {
        console.error(`Error fetching Coinbase Exchange ticker for ${pair}:`, error);
        return [];
    }
}

/**
 * Fetches spot prices from Coinbase for specified currency pairs and amounts.
 * @returns A promise that resolves to an array of price data.
 */
export async function getCoinbasePrice(): Promise<PriceDataAttributes[]> {
    const timestamp = new Date();

    const fetchPromises = PAIRS_TO_FETCH.map(async (pair) => {
        try {
            const response = await fetch(`${API_URL}/${pair}/spot`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch data for ${pair}: ${response.status} ${response.statusText} - ${errorText}`);
                return [];
            }

            const data = (await response.json()) as CoinbaseResponse;

            const rate = parseFloat(data.data.amount);

            if (!Number.isFinite(rate)) {
                console.error(`Invalid rate data for ${pair}: ${data.data.amount}`);
                return [];
            }

            const resultsForPair: PriceDataAttributes[] = [];

            for (const amount of AMOUNTS) {
                resultsForPair.push({
                    id: generateUUID(),
                    timestamp,
                    source: 'Coinbase',
                    currency_pair: pair,
                    amount: amount,
                    rate: rate,
                });
            }

            return resultsForPair;
        } catch (error) {
            console.error(`Error fetching or processing data for ${pair}:`, error);
            return [];
        }
    });

    const exchangeFetchPromises = EXCHANGE_PAIRS_TO_FETCH.map((pair) => getCoinbaseExchangeTickerPrice(pair, timestamp));
    const resultsByPair = await Promise.all([...fetchPromises, ...exchangeFetchPromises]);

    return resultsByPair.flat();
}
