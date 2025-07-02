import sequelize from './db';
import PriceData from './db/schema';
import {getBinancePrice} from './sources/binance';
import {getUniswapPrice} from './sources/uniswap';
import {getPendulumPrice} from './sources/pendulum';
import {getVortexPrice} from './sources/vortex';
import {getTwelveDataPrice} from './sources/twelvedata';
import {generateUUID} from "./utils/uuid.ts";

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
}

// Run once on startup
fetchAndStorePrices();
