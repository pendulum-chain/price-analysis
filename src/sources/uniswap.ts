import { ethers } from 'ethers';
import { Pool } from '@uniswap/v3-sdk';
import { Token, CurrencyAmount } from '@uniswap/sdk-core';
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import type { PriceData } from '../types';

// Pool address for USDC/BRLA on Polygon
const POOL_ADDRESS = '0x0E7754127dEDd4097be750825Dbb4669bc32c956';
const RPC_URL = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Polygon token addresses
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const BRLA_ADDRESS = '0xE6A537a407488807F0bbeb0038B79004f19DDDFb';

const USDC = new Token(137, USDC_ADDRESS, 6, 'USDC', 'USD Coin');
const BRLA = new Token(137, BRLA_ADDRESS, 18, 'BRLA', 'BRLA Token');

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

export async function getUniswapPrice(): Promise<PriceData[]> {
  const poolInfo = await getPoolInfo();

  const pool = new Pool(
    USDC,
    BRLA,
    poolInfo.fee,
    poolInfo.sqrtPriceX96.toString(),
    poolInfo.liquidity.toString(),
    poolInfo.tick
  );

  const amounts = [1000, 10000, 100000];
  const results: PriceData[] = [];

  for (const amount of amounts) {
    const amountIn = CurrencyAmount.fromRawAmount(BRLA, (amount * (10 ** BRLA.decimals)).toString());
    const price = pool.token0Price.quote(amountIn);
    results.push({
      timestamp: new Date(),
      source: 'Uniswap',
      currency_pair: 'USDC-BRLA',
      amount: amount,
      rate: parseFloat(price.toSignificant(6)),
    });
  }

  return results;
}
