import { ethers } from 'ethers';
import { Pool } from '@uniswap/v3-sdk';
import { Token, CurrencyAmount } from '@uniswap/sdk-core';
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import { priceData } from '../db/schema';

// IMPORTANT: Replace with a valid BRLA-USDC pool address and your Infura project ID.
const POOL_ADDRESS = '0x5555aadAF8e4D463243524442527225431717225'; // This is a placeholder, a real pool address would be needed.
const RPC_URL = 'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID'; // Replace with your Infura project ID or another RPC URL

const provider = new ethers.JsonRpcProvider(RPC_URL);

const BRLA_ADDRESS = '0x9153643942332532aEC9224053136549f55D4291';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const BRLA = new Token(1, BRLA_ADDRESS, 18, 'BRLA', 'BRLA Token');
const USDC = new Token(1, USDC_ADDRESS, 6, 'USDC', 'USD Coin');

interface PoolInfo {
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: ethers.BigNumberish;
  liquidity: ethers.BigNumberish;
  tick: number;
}

async function getPoolInfo(): Promise<PoolInfo> {
  // Using `any` to avoid TypeScript errors with ethers.js v6 contract typings.
  // The methods are dynamically added and TypeScript cannot infer them.
  const poolContract: any = new ethers.Contract(POOL_ADDRESS, IUniswapV3PoolABI, provider);

  const [token0, token1, fee, tickSpacing, liquidity, slot0] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
    poolContract.tickSpacing(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    token0,
    token1,
    fee: Number(fee),
    tickSpacing: Number(tickSpacing),
    liquidity,
    sqrtPriceX96: slot0.sqrtPriceX96,
    tick: Number(slot0.tick),
  };
}

export async function getUniswapPrice() {
  const poolInfo = await getPoolInfo();

  const pool = new Pool(
    BRLA,
    USDC,
    poolInfo.fee,
    poolInfo.sqrtPriceX96.toString(),
    poolInfo.liquidity.toString(),
    poolInfo.tick
  );

  const amounts = [1000, 10000, 100000];
  const results: (typeof priceData.$inferInsert)[] = [];

  for (const amount of amounts) {
    const amountIn = CurrencyAmount.fromRawAmount(BRLA, (amount * (10 ** BRLA.decimals)).toString());
    const price = pool.token0Price.quote(amountIn);
    results.push({
      timestamp: new Date().toISOString(),
      source: 'Uniswap',
      currency_pair: 'BRLA-USDC',
      amount: amount.toString(),
      rate: price.toSignificant(6),
    });
  }

  return results;
}
