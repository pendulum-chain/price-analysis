import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from './uuid.ts';

const Q192 = 2n ** 192n;

export function sqrtPriceX96ToToken1PerToken0(
    sqrtPriceX96: bigint,
    decimals0: number,
    decimals1: number,
): number {
    const scale = 10n ** 18n;
    const numerator = sqrtPriceX96 * sqrtPriceX96 * 10n ** BigInt(decimals0) * scale;
    const denominator = Q192 * 10n ** BigInt(decimals1);
    const scaledPrice = numerator / denominator;

    return Number(scaledPrice) / Number(scale);
}

export function buildSpotRows(params: {
    amounts: number[];
    currencyPair: string;
    rate: number;
    source: string;
    timestamp: Date;
}): PriceDataAttributes[] {
    return params.amounts.map((amount) => ({
        id: generateUUID(),
        timestamp: params.timestamp,
        source: params.source,
        currency_pair: params.currencyPair,
        amount,
        rate: params.rate,
    }));
}
