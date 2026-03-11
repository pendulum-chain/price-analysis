import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";
import {AMOUNTS} from "../index.ts";

const API_URL = 'https://api.coinbase.com/v2/prices';
const PAIRS_TO_FETCH = [
    'EURC-USD',
    'USDC-USD',
    'BRL-USD',
];

interface CoinbaseResponse {
    data: {
        amount: string;
        base: string;
        currency: string;
    };
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

            if (isNaN(rate)) {
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

    const resultsByPair = await Promise.all(fetchPromises);

    return resultsByPair.flat();
}