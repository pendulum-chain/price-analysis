import sequelize from './db';
import PriceData from './db/schema';
import {getBinancePrice} from './sources/binance';
import {getUniswapPrice} from './sources/uniswap';
import {getPendulumPrice} from './sources/pendulum';
import {getVortexPrice} from './sources/vortex';
import {getTwelveDataPrice} from './sources/twelvedata';
import {generateUUID} from "./utils/uuid.ts";

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
            getPendulumPrice(),
            getVortexPrice(),
            getTwelveDataPrice(),
        ];

        const results = await Promise.all(priceSources);
        const prices = results.flat();

        prices.forEach(price => {
            price.timestamp = timestamp; // Ensure all prices have the same timestamp
            price.id = price.id || generateUUID(); // Generate a UUID if not already set
        });

        await PriceData.bulkCreate(prices);

        console.log('Prices stored successfully.');
    } catch (error) {
        console.error('Error fetching or storing prices:', error);
    }

    process.exit(0);
}

// Set a timeout to ensure the process exits after 1 minute regardless
setTimeout(() => {
    console.log('Timeout reached, forcing exit...');
    process.exit(1);
}, 60 * 1000);

// Run once on startup
fetchAndStorePrices();
