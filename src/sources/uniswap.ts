import {ethers, Interface} from 'ethers';
import {Token} from '@uniswap/sdk-core';
import {
    abi as IUniswapV3PoolABI
} from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import {
    abi as IQuoterV2ABI
} from '@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoterV2.sol/IQuoterV2.json';
import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";
import {AMOUNTS} from "../index.ts";

// BRLA/USDT pools on Polygon (Uniswap V3). Both pools below currently hold
// liquidity, so we quote each one separately. The 0.01% and 1% pools exist but
// are empty, so they are omitted.
const POOL_ADDRESSES = [
    '0x26970f28fd257c11b937625251ebc804c6a59264', // 0.05% fee tier (deepest liquidity)
    '0xb038a99f0007173557883f6c660ece09c531def5', // 0.30% fee tier
];
// Correct Uniswap V3 QuoterV2 address for Polygon
const QUOTER_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
const RPC_URL = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Polygon token addresses
const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const BRLA_ADDRESS = '0xE6A537a407488807F0bbeb0038B79004f19DDDFb';

const USDT = new Token(137, USDT_ADDRESS, 6, 'USDT', 'Tether USD');
const BRLA = new Token(137, BRLA_ADDRESS, 18, 'BRLA', 'BRLA Token');

// Turn a Uniswap fee (in hundredths of a bip, e.g. 500) into a readable label
// used to distinguish pools in the `source` column, e.g. "Uniswap 0.05%".
function sourceLabel(fee: bigint): string {
    const percent = Number(fee) / 10_000;
    return `Uniswap ${percent}%`;
}

async function getPoolPrices(poolAddress: string): Promise<PriceDataAttributes[]> {
    const poolInterface = new Interface(IUniswapV3PoolABI);
    const quoterInterface = new Interface(IQuoterV2ABI);

    const poolContract = new ethers.Contract(poolAddress, poolInterface, provider);
    const quoterContract = new ethers.Contract(QUOTER_ADDRESS, quoterInterface, provider);

    // Get pool fee
    const fee = await poolContract.getFunction("fee").staticCall();
    const source = sourceLabel(fee);

    const results: PriceDataAttributes[] = [];

    // Get the quoteExactInputSingle function that takes a struct parameter
    const quoteFunction = quoterContract.getFunction("quoteExactInputSingle((address,address,uint256,uint24,uint160))");

    for (const amount of AMOUNTS) {
        // Get the USDT -> BRLA price
        const rawAmountUsdt = ethers.parseUnits(amount.toString(), USDT.decimals);
        const usdtToBrlaParams = {
            tokenIn: USDT.address,
            tokenOut: BRLA.address,
            amountIn: rawAmountUsdt,
            fee: fee,
            sqrtPriceLimitX96: 0n
        };

        try {
            const quotedAmountOutBrlaResult = await quoteFunction.staticCall(usdtToBrlaParams);
            const quotedAmountOutBrla = quotedAmountOutBrlaResult[0];
            const quotedAmountOutBrlaFormatted = ethers.formatUnits(quotedAmountOutBrla, BRLA.decimals);

            const rateUsdtBrla = parseFloat(quotedAmountOutBrlaFormatted) / amount;

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: source,
                currency_pair: 'USDT-BRLA',
                amount: amount,
                rate: rateUsdtBrla
            });
        } catch (error) {
            console.error(`Error fetching USDT -> BRLA quote on ${source} for amount ${amount}:`, error);
        }

        // Get the BRLA -> USDT price
        const rawAmountBrla = ethers.parseUnits(amount.toString(), BRLA.decimals);
        const brlaToUsdtParams = {
            tokenIn: BRLA.address,
            tokenOut: USDT.address,
            amountIn: rawAmountBrla,
            fee: fee,
            sqrtPriceLimitX96: 0n
        };

        try {
            const quotedAmountOutUsdtResult = await quoteFunction.staticCall(brlaToUsdtParams);
            const quotedAmountOutUsdt = quotedAmountOutUsdtResult[0];
            const quotedAmountOutUsdtFormatted = ethers.formatUnits(quotedAmountOutUsdt, USDT.decimals);

            const rateBrlaUsdt = parseFloat(quotedAmountOutUsdtFormatted) / amount;

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: source,
                currency_pair: 'BRLA-USDT',
                amount: amount,
                rate: rateBrlaUsdt
            });
        } catch (error) {
            console.error(`Error fetching BRLA -> USDT quote on ${source} for amount ${amount}:`, error);
        }
    }

    return results;
}

export async function getUniswapPrice(): Promise<PriceDataAttributes[]> {
    const resultsPerPool = await Promise.all(POOL_ADDRESSES.map((pool) => getPoolPrices(pool)));
    return resultsPerPool.flat();
}
