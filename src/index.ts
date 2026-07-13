import sequelize from './db';
import {trimOldPriceData} from './db/retention';
import PriceData from './db/schema';
import {getCoinbasePrice} from './sources/coinbase';
import {getPythPrice} from './sources/pyth';
import {generateUUID} from './utils/uuid.ts';
import {getUniswapPrice} from "./sources/uniswap.ts";
import {getVortexPrice} from "./sources/vortex.ts";
import {getBinancePrice} from "./sources/binance.ts";
import {getFastForexPrice} from './sources/fastforex.ts';
import {getAerodromePrice} from './sources/aerodrome.ts';
import {getCirclePrice} from './sources/circle.ts';
import {getBlindpayPrice} from './sources/blindpay.ts';

// The amounts to fetch prices for
export const AMOUNTS = [1000, 10000, 50000, 100000];

async function fetchAndStorePrices() {
    console.log('Fetching and storing prices...');
    try {
        await sequelize.sync();
        const timestamp = new Date();
        const priceSources = [
            getBinancePrice(),
            getUniswapPrice(),
            getAerodromePrice(),
            getFastForexPrice(),
            //getPendulumPrice(),
            getVortexPrice(),
            //getTwelveDataPrice(),
            getPythPrice(),
            getCoinbasePrice(),
            getCirclePrice(),
            getBlindpayPrice(),
        ];

        const results = await Promise.all(priceSources);
        const prices = results.flat();

        prices.forEach(price => {
            price.timestamp = timestamp; // Ensure all prices have the same timestamp
            price.id = price.id || generateUUID(); // Generate a UUID if not already set
        });

        await PriceData.bulkCreate(prices);

        await trimOldPriceData();

        console.log('Prices stored successfully.');
    } catch (error) {
        console.error('Error fetching or storing prices:', error);
    }

    process.exit(0);
}

// Set a timeout to ensure the process exits after 2 minutes regardless
setTimeout(() => {
    console.log('Timeout reached, forcing exit...');
    process.exit(1);
}, 120 * 1000);

// Run once on startup
fetchAndStorePrices();
