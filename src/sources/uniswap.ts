export async function getUniswapPrice() {
  return {
    timestamp: new Date().toISOString(),
    source: 'Uniswap',
    currency_pair: 'BRL-USDT',
    amount: '1000',
    rate: '5.41',
  };
}
