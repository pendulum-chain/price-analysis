import sequelize from './src/db';
import PriceData from './src/db/schema';
import { getBinancePrice } from './src/sources/binance';
import { getUniswapPrice } from './src/sources/uniswap';
import { getPendulumPrice } from './src/sources/pendulum';
import { getVortexPrice } from './src/sources/vortex';

async function fetchAndStorePrices() {
  console.log('Fetching and storing prices...');
  try {
    await sequelize.sync();
    const priceSources = [
      getBinancePrice(),
      getUniswapPrice(),
      getPendulumPrice(),
      getVortexPrice(),
    ];

    const results = await Promise.all(priceSources);
    const prices = results.flat();

    await PriceData.bulkCreate(prices);

    console.log('Prices stored successfully.');
  } catch (error) {
    console.error('Error fetching or storing prices:', error);
  }
}

// Run every 30 minutes (1800000 milliseconds)
setInterval(fetchAndStorePrices, 1800000);

// Run once on startup
fetchAndStorePrices();
