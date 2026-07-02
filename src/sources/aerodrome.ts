import {ethers} from 'ethers';
import type {PriceDataAttributes} from '../db/schema';
import {AMOUNTS} from '../index.ts';
import {buildSpotRows, sqrtPriceX96ToToken1PerToken0} from '../utils/price-math.ts';

const POOL_ADDRESS = '0xE846373C1a92B167b4E9cd5d8E4d6B1Db9E90EC7';
const EURC_ADDRESS = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42'.toLowerCase();
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
const TOKEN_DECIMALS: Record<string, number> = {
    [EURC_ADDRESS]: 6,
    [USDC_ADDRESS]: 6,
};

const RPC_URL = process.env.BASE_RPC_URL ?? (
    process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined
);

const POOL_ABI = [
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)',
];

interface SlipstreamSlot0Result extends Array<unknown> {
    0: bigint;
}

export async function getAerodromePrice(): Promise<PriceDataAttributes[]> {
    if (!RPC_URL) {
        console.error('Base RPC URL not configured. Set BASE_RPC_URL or ALCHEMY_API_KEY.');
        return [];
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
        const [token0Raw, token1Raw, slot0] = await Promise.all([
            poolContract.getFunction('token0').staticCall() as Promise<string>,
            poolContract.getFunction('token1').staticCall() as Promise<string>,
            poolContract.getFunction('slot0').staticCall() as Promise<SlipstreamSlot0Result>,
        ]);

        const token0 = token0Raw.toLowerCase();
        const token1 = token1Raw.toLowerCase();
        const decimals0 = TOKEN_DECIMALS[token0];
        const decimals1 = TOKEN_DECIMALS[token1];

        if (decimals0 === undefined || decimals1 === undefined) {
            console.error(`Unexpected Aerodrome EURC/USDC token ordering: token0=${token0Raw}, token1=${token1Raw}`);
            return [];
        }

        const token1PerToken0 = sqrtPriceX96ToToken1PerToken0(slot0[0], decimals0, decimals1);
        const rate = token0 === EURC_ADDRESS && token1 === USDC_ADDRESS
            ? token1PerToken0
            : 1 / token1PerToken0;

        if (!Number.isFinite(rate)) {
            console.error(`Invalid Aerodrome EURC-USDC rate: ${rate}`);
            return [];
        }

        return buildSpotRows({
            amounts: AMOUNTS,
            currencyPair: 'EURC-USDC',
            rate,
            source: 'Aerodrome',
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Error fetching Aerodrome EURC-USDC spot:', error);
        return [];
    }
}
