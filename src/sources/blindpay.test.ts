import {afterAll, expect, mock, spyOn, test} from 'bun:test';

// index.ts runs the whole fetch-and-store job on import; stub it down to the shared AMOUNTS.
mock.module('../index.ts', () => ({AMOUNTS: [1000, 100000]}));

const RATES: Record<string, number> = {USDC: 0.18, USDT: 0.19};
const originalFetch = globalThis.fetch;
afterAll(() => {
    globalThis.fetch = originalFetch;
});

test('quotes every configured token under its own pair, skipping amounts below the OTC minimum', async () => {
    process.env.BLINDPAY_API_KEY = 'test-key';
    process.env.BLINDPAY_INSTANCE_ID = 'in_test';
    process.env.BLINDPAY_BLOCKCHAIN_WALLET_ID = 'bw_test';
    process.env.BLINDPAY_TOKEN = 'usdc, USDT';

    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        const rate = RATES[body.token ?? body.to]!;
        const stablecoinCents = body.request_amount * rate;
        if (body.is_otc) {
            if (body.request_amount < 6_000_000) {
                return new Response('{"code":"otc_minimum_amount_not_met"}', {status: 400});
            }
            return Response.json({is_otc: true, receiver_amount: stablecoinCents});
        }
        return Response.json({result_amount: stablecoinCents});
    }) as typeof fetch;
    const errorSpy = spyOn(console, 'error');
    spyOn(console, 'warn').mockImplementation(() => {});

    const {getBlindpayPrice, getBlindpayOtcPrice} = await import('./blindpay.ts');
    const summarize = (rows: {source: string; currency_pair: string; amount: number; rate: number}[]) =>
        rows.map(r => `${r.source}|${r.currency_pair}|${r.amount}|${r.rate.toFixed(2)}`).sort();

    expect(summarize(await getBlindpayPrice())).toEqual([
        'BlindPay|BRL-USDC|100000|0.18',
        'BlindPay|BRL-USDC|1000|0.18',
        'BlindPay|BRL-USDT|100000|0.19',
        'BlindPay|BRL-USDT|1000|0.19',
    ]);
    expect(summarize(await getBlindpayOtcPrice())).toEqual([
        'BlindPay OTC|BRL-USDC|100000|0.18',
        'BlindPay OTC|BRL-USDC|60000|0.18',
        'BlindPay OTC|BRL-USDC|80000|0.18',
        'BlindPay OTC|BRL-USDT|100000|0.19',
        'BlindPay OTC|BRL-USDT|60000|0.19',
        'BlindPay OTC|BRL-USDT|80000|0.19',
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
});
