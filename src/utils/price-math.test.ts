import {describe, expect, test} from 'bun:test';
import {sqrtPriceX96ToToken1PerToken0} from './price-math.ts';

describe('sqrtPriceX96ToToken1PerToken0', () => {
    test('converts a 1:1 Q64.96 price when token decimals match', () => {
        const sqrtPriceX96 = 2n ** 96n;

        expect(sqrtPriceX96ToToken1PerToken0(sqrtPriceX96, 6, 6)).toBe(1);
    });

    test('applies token decimal differences', () => {
        const sqrtPriceX96 = 2n ** 96n;

        expect(sqrtPriceX96ToToken1PerToken0(sqrtPriceX96, 6, 18)).toBe(0.000000000001);
    });
});
