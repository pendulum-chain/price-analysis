import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from '../utils/uuid.ts';
import {AMOUNTS} from '../index.ts';

// Circle Mint Exchange API — indicative EURC/USDC rates.
// A Circle Mint account and API key are required (Authorization: Bearer <key>).
// Docs: https://developers.circle.com/circle-mint/howtos/exchange-currencies
//
// We request "reference" quotes, which are indicative only and cannot be
// accepted for a trade — perfect for price collection, since they never lock a
// rate or move funds. (A "tradable" quote would lock the rate for 3 seconds.)
const BASE_URL = process.env.CIRCLE_API_BASE_URL ?? 'https://api.circle.com';
const API_URL = `${BASE_URL}/v1/exchange/quotes`;

// EURC-USDC: USDC received per 1 EURC; USDC-EURC: EURC received per 1 USDC.
const PAIRS = [
    {from: 'EURC', to: 'USDC', currency_pair: 'EURC-USDC'},
    {from: 'USDC', to: 'EURC', currency_pair: 'USDC-EURC'},
];

interface CircleQuoteResponse {
    data?: {
        id: string;
        rate: number;
        from: {currency: string; amount: string};
        to: {currency: string; amount: string};
        expiry?: string;
        type: string;
    };
}

export async function getCirclePrice(): Promise<PriceDataAttributes[]> {
    const apiKey = process.env.CIRCLE_API_KEY;

    if (!apiKey) {
        console.warn('CIRCLE_API_KEY not set, skipping Circle price source');
        return [];
    }

    const results: PriceDataAttributes[] = [];

    for (const pair of PAIRS) {
        for (const amount of AMOUNTS) {
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        type: 'reference',
                        idempotencyKey: generateUUID(),
                        from: {currency: pair.from, amount: amount.toString()},
                        to: {currency: pair.to},
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(
                        `Circle quote failed for ${pair.currency_pair} with amount ${amount}: ${response.status} ${response.statusText} - ${errorText}`,
                    );
                    continue;
                }

                const data = (await response.json()) as CircleQuoteResponse;
                const quote = data.data;

                if (!quote) {
                    console.error(`Circle quote missing data for ${pair.currency_pair} with amount ${amount}`);
                    continue;
                }

                const inputAmount = parseFloat(quote.from.amount);
                const outputAmount = parseFloat(quote.to.amount);
                const rate = outputAmount / inputAmount;

                if (!Number.isFinite(rate)) {
                    console.error(
                        `Invalid Circle rate for ${pair.currency_pair} with amount ${amount}: ${quote.to.amount}/${quote.from.amount}`,
                    );
                    continue;
                }

                results.push({
                    id: generateUUID(),
                    timestamp: new Date(),
                    source: 'Circle',
                    currency_pair: pair.currency_pair,
                    amount: amount,
                    rate: rate,
                });
            } catch (error) {
                console.error(`Error fetching Circle price for ${pair.currency_pair} with amount ${amount}:`, error);
            }
        }
    }

    return results;
}
