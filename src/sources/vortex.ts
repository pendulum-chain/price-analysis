export async function getVortexPrice() {
  return {
    timestamp: new Date().toISOString(),
    source: 'Vortex',
    currency_pair: 'BRL-USDT',
    amount: '1000',
    rate: '5.42',
  };
}
