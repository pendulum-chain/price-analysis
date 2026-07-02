import type {PriceDataAttributes} from '../db/schema';
import {AMOUNTS} from '../index.ts';
import {buildSpotRows} from '../utils/price-math.ts';

const API_URL = 'https://api.fastforex.io/fetch-one';

interface FastForexResponse {
    base: string;
    result: Record<string, number>;
    updated?: string;
}

export async function getFastForexPrice(): Promise<PriceDataAttributes[]> {
    const apiKey = process.env.FASTFOREX_API_KEY;

    if (!apiKey) {
        console.error('FastForex API key not found in environment variables');
        return [];
    }

    const url = new URL(API_URL);
    url.searchParams.set('from', 'EUR');
    url.searchParams.set('to', 'USD');
    url.searchParams.set('api_key', apiKey);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch FastForex EUR-USD: ${response.status} ${response.statusText} - ${errorText}`);
            return [];
        }

        const data = (await response.json()) as FastForexResponse;
        const rate = data.result.USD;

        if (typeof rate !== 'number' || !Number.isFinite(rate)) {
            console.error(`Invalid FastForex EUR-USD rate: ${rate}`);
            return [];
        }

        return buildSpotRows({
            amounts: AMOUNTS,
            currencyPair: 'EUR-USD',
            rate,
            source: 'FastForex',
            timestamp: data.updated ? new Date(data.updated) : new Date(),
        });
    } catch (error) {
        console.error('Error fetching or processing FastForex EUR-USD:', error);
        return [];
    }
}
