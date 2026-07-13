import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from '../utils/uuid.ts';
import {AMOUNTS} from '../index.ts';

// BlindPay payin FX rates — indicative fiat -> stablecoin price (how much stablecoin the
// receiver gets per 1 BRL sent). Uses the lightweight payin FX-rate endpoint, which needs
// only an API key + instance id (no receiver/KYC/blockchain-wallet setup) and never moves
// funds. Docs: https://api.blindpay.com/reference
//
// NOTE: This targets the BlindPay *sandbox*. Sandbox/dev instances only support the "USDB"
// token (a 1:1 USD test stablecoin), so we request USDB and report it under the BRL-USDC
// pair for comparability with the other BRL-USDC sources. In production, set
// BLINDPAY_TOKEN=USDC (or USDT). The source name makes the sandbox origin explicit.
const BASE_URL = process.env.BLINDPAY_BASE_URL ?? 'https://api.blindpay.com/v1';
const TOKEN = process.env.BLINDPAY_TOKEN ?? 'USDB';
// USDB is the sandbox-only stand-in for USDC: report it under the USDC pair and tag the
// source as sandbox. In production (USDC/USDT) the pair and source reflect the real token.
const IS_SANDBOX = TOKEN === 'USDB';
const REPORTED_STABLECOIN = IS_SANDBOX ? 'USDC' : TOKEN;
const CURRENCY_PAIR = `BRL-${REPORTED_STABLECOIN}`;
const SOURCE = IS_SANDBOX ? 'BlindPay (sandbox)' : 'BlindPay';

// BlindPay rejects payin quotes below this amount (in cents of the sender currency).
const MIN_REQUEST_AMOUNT_CENTS = 500;

// A stalled request must not hang the surrounding Promise.all for the whole run.
const REQUEST_TIMEOUT_MS = 30_000;

interface BlindpayFxResponse {
    commercial_quotation: number;
    blindpay_quotation: number;
    // Resulting amount on the other side of the conversion, in cents.
    result_amount: number;
    instance_flat_fee: number;
    instance_percentage_fee: number;
}

export async function getBlindpayPrice(): Promise<PriceDataAttributes[]> {
    const apiKey = process.env.BLINDPAY_API_KEY;
    const instanceId = process.env.BLINDPAY_INSTANCE_ID;

    if (!apiKey || !instanceId) {
        console.warn('BLINDPAY_API_KEY or BLINDPAY_INSTANCE_ID not set, skipping BlindPay price source');
        return [];
    }

    const url = `${BASE_URL}/instances/${instanceId}/payin-quotes/fx`;
    const results: PriceDataAttributes[] = [];

    for (const amount of AMOUNTS) {
        // `request_amount` is an integer in cents of the sender (BRL) currency.
        const requestAmountCents = Math.round(amount * 100);
        if (requestAmountCents < MIN_REQUEST_AMOUNT_CENTS) {
            continue;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currency_type: 'sender',
                    from: 'BRL',
                    to: TOKEN,
                    request_amount: requestAmountCents,
                }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    `BlindPay quote failed for ${CURRENCY_PAIR} with amount ${amount}: ${response.status} ${response.statusText} - ${errorText}`,
                );
                continue;
            }

            const data = (await response.json()) as BlindpayFxResponse;

            // `result_amount` is in cents of the target stablecoin. Rate = stablecoin per 1 BRL.
            const outputAmount = data.result_amount / 100;
            const rate = outputAmount / amount;

            if (!Number.isFinite(rate) || rate <= 0) {
                console.error(
                    `Invalid BlindPay rate for ${CURRENCY_PAIR} with amount ${amount}: result_amount=${data.result_amount}`,
                );
                continue;
            }

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: SOURCE,
                currency_pair: CURRENCY_PAIR,
                amount: amount,
                rate: rate,
            });
        } catch (error) {
            console.error(`Error fetching BlindPay price for ${CURRENCY_PAIR} with amount ${amount}:`, error);
        }
    }

    return results;
}
