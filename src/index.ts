import sequelize from './db';
import PriceData from './db/schema';
import { getBinancePrice } from './sources/binance';
import { getUniswapPrice } from './sources/uniswap';
import { getPendulumPrice } from './sources/pendulum';
import { getVortexPrice } from './sources/vortex';

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
