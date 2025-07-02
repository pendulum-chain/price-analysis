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

// Pool address for USDC/BRLA on Polygon
const POOL_ADDRESS = '0x0E7754127dEDd4097be750825Dbb4669bc32c956';
const QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const RPC_URL = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Polygon token addresses
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const BRLA_ADDRESS = '0xE6A537a407488807F0bbeb0038B79004f19DDDFb';

const USDC = new Token(137, USDC_ADDRESS, 6, 'USDC', 'USD Coin');
const BRLA = new Token(137, BRLA_ADDRESS, 18, 'BRLA', 'BRLA Token');

export async function getUniswapPrice(): Promise<PriceDataAttributes[]> {
    const poolInterface = new Interface(IUniswapV3PoolABI);
    const quoterInterface = new Interface(IQuoterV2ABI);

    const poolContract = new ethers.Contract(POOL_ADDRESS, poolInterface, provider);
    const quoterContract = new ethers.Contract(QUOTER_ADDRESS, quoterInterface, provider);

    const feeResult = await poolContract.getFunction("fee").staticCall();
    const fee = feeResult[0];

    const amounts = [1000, 10000, 100000];
    const results: PriceDataAttributes[] = [];

    // This is the signature for the overloaded function that takes a struct (tuple)
    const quoteFunction = quoterContract.getFunction("quoteExactInputSingle((address,address,uint256,uint24,uint160))");

    for (const amount of amounts) {
        // Get the USDC -> BRLA price
        const rawAmountUsdc = ethers.parseUnits(amount.toString(), USDC.decimals);
        const usdcToBrlaParams = [USDC.address, BRLA.address, rawAmountUsdc, fee, 0];
        console.log("usdcToBrlaParams", usdcToBrlaParams);
        try {

            const quotedAmountOutBrlaResult = await quoteFunction.staticCall(usdcToBrlaParams);
            console.log("quotedAmountOutBrlaResult", quotedAmountOutBrlaResult);
            const quotedAmountOutBrla = quotedAmountOutBrlaResult[0];

            const rateUsdcBrla = parseFloat(ethers.formatUnits(quotedAmountOutBrla, BRLA.decimals)) / amount;
            console.log(`Got quote for ${amount} USDC -> BRLA:`, ethers.formatUnits(quotedAmountOutBrla, BRLA.decimals), "rate", rateUsdcBrla);

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: 'Uniswap',
                currency_pair: 'USDC-BRLA',
                amount: amount,
                rate: rateUsdcBrla
            });
        } catch (error) {
            console.error(`Error fetching USDC -> BRLA quote for amount ${amount}:`, error);
        }

        // Get the BRLA -> USDC price
        const rawAmountBrla = ethers.parseUnits(amount.toString(), BRLA.decimals);
        const brlaToUsdcParams = [BRLA.address, USDC.address, rawAmountBrla, fee, 0];
        console.log("brlaToUsdcParams", brlaToUsdcParams);
        try {
            const quotedAmountOutUsdcResult = await quoteFunction.staticCall(brlaToUsdcParams);
            const quotedAmountOutUsdc = quotedAmountOutUsdcResult[0];

            const rateBrlaUsdc = parseFloat(ethers.formatUnits(quotedAmountOutUsdc, USDC.decimals)) / amount;
            console.log(`Got quote for ${amount} BRLA -> USDC:`, ethers.formatUnits(quotedAmountOutUsdc, USDC.decimals), "rate", rateBrlaUsdc);

            results.push({
                id: generateUUID(),
                timestamp: new Date(),
                source: 'Uniswap',
                currency_pair: 'BRLA-USDC',
                amount: amount,
                rate: rateBrlaUsdc
            });
        } catch (error) {
            console.error(`Error fetching BRLA -> USDC quote for amount ${amount}:`, error);
        }
    }

    return results;
}
