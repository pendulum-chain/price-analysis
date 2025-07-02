import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";

const API_URL = 'https://api.twelvedata.com/time_series';
const API_KEY = process.env.TWELVEDATA_API_KEY;
const SYMBOLS_TO_FETCH = [
    {apiSymbol: 'EUR/USD', pair: 'EUR-USD'},
    {apiSymbol: 'USD/BRL', pair: 'USD-BRL'},
    {apiSymbol: 'GBP/USD', pair: 'GBP-USD'},
    {apiSymbol: 'USD/JPY', pair: 'USD-JPY'},
];
const AMOUNTS = [1000, 10000, 100000];

interface TwelveDataResponse {
    meta: {
        symbol: string;
        interval: string;
        currency_base: string;
        currency_quote: string;
        type: string;
    };
    values: Array<{
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
    }>;
    status: string;
}

/**
 * Fetches forex rates from TwelveData for specified currency pairs and amounts.
 * @returns A promise that resolves to an array of price data.
 */
export async function getTwelveDataPrice(): Promise<PriceDataAttributes[]> {
    if (!API_KEY) {
        console.error('TwelveData API key not found in environment variables');
        return [];
    }

    const timestamp = new Date();

    const fetchPromises = SYMBOLS_TO_FETCH.map(async ({apiSymbol, pair}) => {
        try {
            const url = new URL(API_URL);
            url.searchParams.append('apikey', API_KEY);
            url.searchParams.append('interval', '1min');
            url.searchParams.append('symbol', apiSymbol);
            url.searchParams.append('format', 'JSON');
            url.searchParams.append('dp', '6');
            url.searchParams.append('outputsize', '1'); // Get only the latest data point

            const response = await fetch(url.toString());
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch data for ${apiSymbol}: ${response.status} ${response.statusText} - ${errorText}`);
                return [];
            }

            const data = (await response.json()) as TwelveDataResponse;
            
            if (data.status === 'error' || !data.values || data.values.length === 0) {
                console.error(`No data available for ${apiSymbol}`);
                return [];
            }

            // Get the most recent price (close price)
            const latestValue = data.values[0];
            if (!latestValue) {
                console.error(`No latest value available for ${apiSymbol}`);
                return [];
            }
            
            const rate = parseFloat(latestValue.close);
            
            if (isNaN(rate)) {
                console.error(`Invalid rate data for ${apiSymbol}: ${latestValue.close}`);
                return [];
            }

            const resultsForSymbol: PriceDataAttributes[] = [];

            // Create entries for each amount
            for (const amount of AMOUNTS) {
                resultsForSymbol.push({
                    id: generateUUID(),
                    timestamp,
                    source: 'TwelveData',
                    currency_pair: pair,
                    amount: amount,
                    rate: rate,
                });
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
