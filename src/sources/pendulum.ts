import type { PriceData } from '../types';
import ApiManager from '../utils/api-manager';

export async function getPendulumPrice(): Promise<PriceData[]> {
  const api = await ApiManager.getApi('pendulum');
  const decimals = ApiManager.getDecimals('pendulum');

  const entries = await (api.query as any).diaOracleModule.coinInfosMap.entries();
  const prices: PriceData[] = [];

  const targetPairs = ['EUR-USD', 'BRL-USD'];

  for (const [, coinInfo] of entries) {
    const parsedCoinInfo = JSON.parse(JSON.stringify(coinInfo));
    const symbol = parsedCoinInfo.symbol;

    if (targetPairs.includes(symbol)) {
      const price = parsedCoinInfo.price / 10 ** decimals;
      const timestamp = new Date(parsedCoinInfo.timestamp * 1000);

      for (const amount of [1000, 10000, 100000]) {
        prices.push({
          timestamp,
          source: 'Pendulum',
          currency_pair: symbol,
          amount,
          rate: price,
        });
      }
    }
  }

  return prices;
}
