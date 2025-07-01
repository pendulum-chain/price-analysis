export async function getBinancePrice() {
  return {
    timestamp: new Date().toISOString(),
    source: 'Binance',
    currency_pair: 'BRL-USDT',
    amount: '1000',
    rate: '5.40',
  };
}
