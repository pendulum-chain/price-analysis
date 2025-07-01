export async function getPendulumPrice() {
  return {
    timestamp: new Date().toISOString(),
    source: 'Pendulum',
    currency_pair: 'BRL-USDT',
    amount: '1000',
    rate: '5.39',
  };
}
