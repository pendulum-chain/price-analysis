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

// Correct Uniswap V3 QuoterV2 address for Polygon
const QUOTER_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
const RPC_URL = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Polygon token addresses
const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // native USDC
const BRLA_ADDRESS = '0xE6A537a407488807F0bbeb0038B79004f19DDDFb';

const USDT = new Token(137, USDT_ADDRESS, 6, 'USDT', 'Tether USD');
const USDC = new Token(137, USDC_ADDRESS, 6, 'USDC', 'USD Coin');
const BRLA = new Token(137, BRLA_ADDRESS, 18, 'BRLA', 'BRLA Token');

// BRLA pools on Polygon (Uniswap V3) that currently hold liquidity. Each pool is
// paired against a different quote token / fee tier; empty pools are omitted.
// A pool is identified in the data by its fee tier (source) plus quote token
// (currency_pair), e.g. source "Uniswap 0.05%" + pair "BRLA-USDT".
const POOLS: {address: string; quote: Token}[] = [
    {address: '0x26970f28fd257c11b937625251ebc804c6a59264', quote: USDT}, // BRLA/USDT 0.05% (deepest)
    {address: '0xb038a99f0007173557883f6c660ece09c531def5', quote: USDT}, // BRLA/USDT 0.30%
    {address: '0x0E7754127dEDd4097be750825Dbb4669bc32c956', quote: USDC}, // BRLA/USDC 0.05%
];

// Turn a Uniswap fee (in hundredths of a bip, e.g. 500) into a readable label
// used to distinguish fee tiers in the `source` column, e.g. "Uniswap 0.05%".
function sourceLabel(fee: bigint): string {
    const percent = Number(fee) / 10_000;
    return `Uniswap ${percent}%`;
}

async function getPoolPrices(poolAddress: string, quote: Token): Promise<PriceDataAttributes[]> {
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
        // Get the <quote> -> BRLA price
        const rawAmountQuote = ethers.parseUnits(amount.toString(), quote.decimals);
        const quoteToBrlaParams = {
            tokenIn: quote.address,
            tokenOut: BRLA.address,
            amountIn: rawAmountQuote,
            fee: fee,
            sqrtPriceLimitX96: 0n
        };

        try {
            const quotedAmountOutBrlaResult = await quoteFunction.staticCall(quoteToBrlaParams);
            const quotedAmountOutBrla = quotedAmountOutBrlaResult[0];
            const quotedAmountOutBrlaFormatted = ethers.formatUnits(quotedAmountOutBrla, BRLA.decimals);

            const rateQuoteBrla = parseFloat(quotedAmountOutBrlaFormatted) / amount;

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: source,
                currency_pair: `${quote.symbol}-BRLA`,
                amount: amount,
                rate: rateQuoteBrla
            });
        } catch (error) {
            console.error(`Error fetching ${quote.symbol} -> BRLA quote on ${source} for amount ${amount}:`, error);
        }

        // Get the BRLA -> <quote> price
        const rawAmountBrla = ethers.parseUnits(amount.toString(), BRLA.decimals);
        const brlaToQuoteParams = {
            tokenIn: BRLA.address,
            tokenOut: quote.address,
            amountIn: rawAmountBrla,
            fee: fee,
            sqrtPriceLimitX96: 0n
        };

        try {
            const quotedAmountOutQuoteResult = await quoteFunction.staticCall(brlaToQuoteParams);
            const quotedAmountOutQuote = quotedAmountOutQuoteResult[0];
            const quotedAmountOutQuoteFormatted = ethers.formatUnits(quotedAmountOutQuote, quote.decimals);

            const rateBrlaQuote = parseFloat(quotedAmountOutQuoteFormatted) / amount;

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: source,
                currency_pair: `BRLA-${quote.symbol}`,
                amount: amount,
                rate: rateBrlaQuote
            });
        } catch (error) {
            console.error(`Error fetching BRLA -> ${quote.symbol} quote on ${source} for amount ${amount}:`, error);
        }
    }

    return results;
}

export async function getUniswapPrice(): Promise<PriceDataAttributes[]> {
    const resultsPerPool = await Promise.all(POOLS.map((pool) => getPoolPrices(pool.address, pool.quote)));
    return resultsPerPool.flat();
}
