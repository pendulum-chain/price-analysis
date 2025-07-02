import type {PriceDataAttributes} from '../db/schema';
import ApiManager from '../utils/api-manager';
import {generateUUID} from "../utils/uuid.ts";
import {AMOUNTS} from "../index.ts";

export async function getPendulumPrice(): Promise<PriceDataAttributes[]> {
    const api = await ApiManager.getApi('pendulum');
    const decimals = ApiManager.getDecimals('pendulum');

    const entries = await (api.query as any).diaOracleModule.coinInfosMap.entries();
    const prices: PriceDataAttributes[] = [];

    const targetPairs = ['EUR-USD', 'BRL-USD'];

    for (const [, coinInfo] of entries) {
        const parsedCoinInfo = coinInfo.toHuman();
        const symbol = parsedCoinInfo.symbol;

        if (targetPairs.includes(symbol)) {
            const price = parsedCoinInfo.price.replaceAll(",", "") / 10 ** decimals;
            const timestamp = new Date(parsedCoinInfo.lastUpdateTimestamp.replaceAll(",", "") * 1000);

            for (const amount of AMOUNTS) {
                prices.push({
                    id: generateUUID(),
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
