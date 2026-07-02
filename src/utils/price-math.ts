import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from './uuid.ts';

const Q192 = 2n ** 192n;
const PRICE_DECIMAL_PRECISION = 10n ** 12n;

export function sqrtPriceX96ToToken1PerToken0(
    sqrtPriceX96: bigint,
    decimals0: number,
    decimals1: number,
): number {
    const scale = 10n ** 18n;
    const numerator = sqrtPriceX96 * sqrtPriceX96 * 10n ** BigInt(decimals0) * scale;
    const denominator = Q192 * 10n ** BigInt(decimals1);
    const scaledPrice = numerator / denominator;
    const integerPart = scaledPrice / scale;
    const fractionalPart = scaledPrice % scale;
    const fractionalPartAtPrecision = (fractionalPart * PRICE_DECIMAL_PRECISION) / scale;

    if (integerPart > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new RangeError(`Price integer part exceeds Number.MAX_SAFE_INTEGER: ${integerPart}`);
    }

    return Number(integerPart) + Number(fractionalPartAtPrecision) / Number(PRICE_DECIMAL_PRECISION);
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
