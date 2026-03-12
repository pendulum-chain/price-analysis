import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";
import {AMOUNTS} from "../index.ts";

const API_URL = 'https://hermes.pyth.network/v2/updates/price/latest';
const IDS = {
    'EURC-USD': '76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c',
    'USDC-USD': 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
};

interface PythResponse {
    parsed: Array<{
        id: string;
        price: {
            price: string;
            conf: string;
            expo: number;
            publish_time: number;
        };
        ema_price: {
            price: string;
            conf: string;
            expo: number;
            publish_time: number;
        };
        metadata: {
            slot: number;
            proof_available_time: number;
            prev_publish_time: number;
        };
    }>;
}

/**
 * Fetches prices from Pyth for specified currency pairs and amounts.
 * @returns A promise that resolves to an array of price data.
 */
export async function getPythPrice(): Promise<PriceDataAttributes[]> {
    const timestamp = new Date();

    try {
        const url = new URL(API_URL);
        Object.values(IDS).forEach(id => url.searchParams.append('ids[]', `0x${id}`));

        const response = await fetch(url.toString());
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch data from Pyth: ${response.status} ${response.statusText} - ${errorText}`);
            return [];
        }

        const data = (await response.json()) as PythResponse;

        if (!data.parsed || data.parsed.length === 0) {
            console.error('No parsed data available from Pyth');
            return [];
        }

        const results: PriceDataAttributes[] = [];

        for (const item of data.parsed) {
            const currency_pair = Object.keys(IDS).find(key => IDS[key as keyof typeof IDS] === item.id);
            if (!currency_pair) {
                console.warn(`Unknown Pyth ID: ${item.id}`);
                continue;
            }

            const rate = parseFloat(item.price.price) * Math.pow(10, item.price.expo);

            if (isNaN(rate)) {
                console.error(`Invalid rate data for ${currency_pair}: ${item.price.price}`);
                continue;
            }

            // Data irrelevant of the amount. For consistency with other sources, duplicate the same rate for all amounts.
            for (const amount of AMOUNTS) {
                results.push({
                    id: generateUUID(),
                    timestamp,
                    source: 'Pyth',
                    currency_pair,
                    amount: amount,
                    rate: rate,
                });
            }
        }

        return results;
    } catch (error) {
        console.error('Error fetching or processing data from Pyth:', error);
        return [];
    }
}