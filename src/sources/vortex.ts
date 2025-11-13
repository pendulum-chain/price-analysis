import type {PriceDataAttributes} from '../db/schema';
import {generateUUID} from "../utils/uuid.ts";
import {AMOUNTS} from "../index.ts";

enum DestinationType {
    Polygon = 'polygon',
    Pix = 'pix',
    Sepa = 'sepa',
}

enum RampCurrency {
    Usdc = 'USDC',
    Usdt = 'USDT',
    Eurc = 'EURC',
    Eur = 'EUR',
    Brl = 'BRL',
}

enum RampType {
    On = 'BUY',
    Off = 'SELL',
}

interface VortexRequestBody {
    from: DestinationType;
    inputAmount: number;
    inputCurrency: RampCurrency;
    network?: string;
    outputCurrency: RampCurrency;
    rampType: RampType;
    to: DestinationType;
    partnerId?: string;
}


interface VortexResponse {
    outputAmount: string;
}

export async function getVortexPrice(): Promise<PriceDataAttributes[]> {
    const VORTEX_API_URL = 'https://api.vortexfinance.co/v1/quotes';
    const results: PriceDataAttributes[] = [];

    const pairs = [
        {
            // BRL-USDT: on-ramp from Pix to Polygon
            rampType: RampType.On,
            from: DestinationType.Pix,
            to: DestinationType.Polygon,
            inputCurrency: RampCurrency.Brl,
            outputCurrency: RampCurrency.Usdt,
            currency_pair: 'BRL-USDT',
        },
        {
            // BRL-USDC: on-ramp from Pix to Polygon
            rampType: RampType.On,
            from: DestinationType.Pix,
            to: DestinationType.Polygon,
            inputCurrency: RampCurrency.Brl,
            outputCurrency: RampCurrency.Usdc,
            network: "polygon",
            currency_pair: 'BRL-USDC',
        },
        {
            // USDT-BRL: off-ramp from Polygon to Pix
            rampType: RampType.Off,
            from: DestinationType.Polygon,
            to: DestinationType.Pix,
            inputCurrency: RampCurrency.Usdt,
            outputCurrency: RampCurrency.Brl,
            currency_pair: 'USDT-BRL',
        },
        {
            // USDC-BRL: off-ramp from Polygon to Pix
            rampType: RampType.Off,
            from: DestinationType.Polygon,
            to: DestinationType.Pix,
            inputCurrency: RampCurrency.Usdc,
            outputCurrency: RampCurrency.Brl,
            currency_pair: 'USDC-BRL',
        },
        {
            // USDC-EUR: off-ramp from Polygon to Sepa
            rampType: RampType.Off,
            from: DestinationType.Polygon,
            to: DestinationType.Sepa,
            inputCurrency: RampCurrency.Usdc,
            outputCurrency: RampCurrency.Eur,
            currency_pair: 'USDC-EUR',
        },
    ];

    for (const pair of pairs) {
        for (const amount of AMOUNTS) {
            const requestBody: VortexRequestBody = {
                rampType: pair.rampType,
                from: pair.from,
                to: pair.to,
                network: pair.network,
                inputCurrency: pair.inputCurrency,
                outputCurrency: pair.outputCurrency,
                inputAmount: amount,
                partnerId: "PriceAnalysis"
            };

            try {
                const response = await fetch(VORTEX_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    console.error(
                        `Vortex API request failed for ${pair.currency_pair} with amount ${amount}: ${response.statusText}`
                    );
                    continue;
                }

                const data = (await response.json()) as VortexResponse;
                const outputAmount = parseFloat(data.outputAmount);
                const rate = outputAmount / amount;

                results.push({
                    id: generateUUID(),
                    timestamp: new Date(),
                    source: 'Vortex',
                    currency_pair: pair.currency_pair,
                    amount: amount,
                    rate: rate,
                });
            } catch (error) {
                console.error(
                    `Error fetching Vortex price for ${pair.currency_pair} with amount ${amount}:`,
                    error
                );
            }
        }
    }

    return results;
}
