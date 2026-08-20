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
const OTC_SOURCE = IS_SANDBOX ? 'BlindPay OTC (sandbox)' : 'BlindPay OTC';

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

interface BlindpayPayinQuoteResponse {
    id: string;
    expires_at: number;
    commercial_quotation: number;
    blindpay_quotation: number;
    // Amounts in cents of the respective currency.
    receiver_amount: number;
    sender_amount: number;
    flat_fee: number;
    is_otc?: boolean | null;
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

// BlindPay OTC quotes — unlike the FX-rate endpoint above, OTC mode is only available on the
// full payin-quote endpoint (`is_otc: true`), which requires a receiver blockchain wallet.
// Quotes expire after 5 minutes and are never executed, so no funds move. OTC quotes are only
// available during business hours; outside of them BlindPay either rejects the request or
// returns a traditional quote (`is_otc` false), which we skip to keep the OTC series clean.
// One-time wallet setup: `bun run scripts/setup-blindpay-otc.ts`.
export async function getBlindpayOtcPrice(): Promise<PriceDataAttributes[]> {
    const apiKey = process.env.BLINDPAY_API_KEY;
    const instanceId = process.env.BLINDPAY_INSTANCE_ID;
    const blockchainWalletId = process.env.BLINDPAY_BLOCKCHAIN_WALLET_ID;

    if (!apiKey || !instanceId) {
        console.warn('BLINDPAY_API_KEY or BLINDPAY_INSTANCE_ID not set, skipping BlindPay OTC price source');
        return [];
    }
    if (!blockchainWalletId) {
        console.warn('BLINDPAY_BLOCKCHAIN_WALLET_ID not set, skipping BlindPay OTC price source');
        return [];
    }

    const url = `${BASE_URL}/instances/${instanceId}/payin-quotes`;
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
                    blockchain_wallet_id: blockchainWalletId,
                    currency_type: 'sender',
                    cover_fees: false,
                    payment_method: 'pix',
                    request_amount: requestAmountCents,
                    token: TOKEN,
                    partner_fee_id: null,
                    is_otc: true,
                }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // OTC has a minimum trade size (~60k BRL as of 2026-07); smaller amounts are
                // expected to be rejected, so don't treat them as errors.
                if (errorText.includes('otc_minimum_amount_not_met')) {
                    console.warn(`BlindPay OTC minimum not met for amount ${amount}, skipping.`);
                    continue;
                }
                console.error(
                    `BlindPay OTC quote failed for ${CURRENCY_PAIR} with amount ${amount}: ${response.status} ${response.statusText} - ${errorText}`,
                );
                continue;
            }

            const data = (await response.json()) as BlindpayPayinQuoteResponse;

            if (data.is_otc !== true) {
                console.warn(
                    `BlindPay returned a non-OTC quote for ${CURRENCY_PAIR} with amount ${amount} (is_otc=${data.is_otc}), skipping. OTC mode is only available during business hours.`,
                );
                continue;
            }

            // `receiver_amount` is in cents of the target stablecoin. Rate = stablecoin per 1 BRL.
            const outputAmount = data.receiver_amount / 100;
            const rate = outputAmount / amount;

            if (!Number.isFinite(rate) || rate <= 0) {
                console.error(
                    `Invalid BlindPay OTC rate for ${CURRENCY_PAIR} with amount ${amount}: receiver_amount=${data.receiver_amount}`,
                );
                continue;
            }

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: OTC_SOURCE,
                currency_pair: CURRENCY_PAIR,
                amount: amount,
                rate: rate,
            });
        } catch (error) {
            console.error(`Error fetching BlindPay OTC price for ${CURRENCY_PAIR} with amount ${amount}:`, error);
        }
    }

    return results;
}
