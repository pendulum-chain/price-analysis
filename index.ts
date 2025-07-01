import { db } from './src/db';
import { priceData } from './src/db/schema';
import { getBinancePrice } from './src/sources/binance';
import { getUniswapPrice } from './src/sources/uniswap';
import { getPendulumPrice } from './src/sources/pendulum';
import { getVortexPrice } from './src/sources/vortex';

async function fetchAndStorePrices() {
  console.log('Fetching and storing prices...');
  try {
    const binancePrice = await getBinancePrice();
    const uniswapPrice = await getUniswapPrice();
    const pendulumPrice = await getPendulumPrice();
    const vortexPrice = await getVortexPrice();

    await db.insert(priceData).values([
      binancePrice,
      uniswapPrice,
      pendulumPrice,
      vortexPrice,
    ]);

    console.log('Prices stored successfully.');
  } catch (error) {
    console.error('Error fetching or storing prices:', error);
  }
}

// Run every 30 minutes (1800000 milliseconds)
setInterval(fetchAndStorePrices, 1800000);

// Run once on startup
fetchAndStorePrices();
