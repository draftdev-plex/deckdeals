import { ServerAPI } from "decky-frontend-lib";
import { CACHE } from "../utils/Cache";

export interface ExchangeRates {
    base: string;
    rates: Record<string, number>;
    timestamp: number;
}

class ExchangeRateService {
    private serverApi: ServerAPI | undefined;
    private readonly API_KEY = "ab1093bd85ac89c09a25b196";
    private readonly CACHE_KEY = "exchange_rates";
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    public init(serverApi: ServerAPI) {
        this.serverApi = serverApi;
    }

    /**
     * Get exchange rates, using cache if available and fresh
     */
    public async getExchangeRates(baseCurrency: string = "USD"): Promise<ExchangeRates | null> {
        if (!this.serverApi) return null;

        // Check cache first
        const cached = await this.getCachedRates(baseCurrency);
        if (cached) {
            return cached;
        }

        // Fetch fresh rates
        return await this.fetchExchangeRates(baseCurrency);
    }

    /**
     * Convert amount from one currency to another
     */
    public async convertCurrency(
        amount: number,
        fromCurrency: string,
        toCurrency: string
    ): Promise<number | null> {
        if (fromCurrency === toCurrency) return amount;

        const rates = await this.getExchangeRates(fromCurrency);
        if (!rates || !rates.rates[toCurrency]) {
            return null;
        }

        return amount * rates.rates[toCurrency];
    }

    /**
     * Convert multiple prices to a target currency
     */
    public async convertPrices(
        prices: Array<{ amount: number; currency: string }>,
        targetCurrency: string
    ): Promise<Array<{ amount: number; originalAmount: number; originalCurrency: string }>> {
        const converted = [];

        for (const price of prices) {
            const convertedAmount = await this.convertCurrency(
                price.amount,
                price.currency,
                targetCurrency
            );

            if (convertedAmount !== null) {
                converted.push({
                    amount: convertedAmount,
                    originalAmount: price.amount,
                    originalCurrency: price.currency
                });
            }
        }

        return converted;
    }

    private async getCachedRates(baseCurrency: string): Promise<ExchangeRates | null> {
        const cacheKey = `${this.CACHE_KEY}_${baseCurrency}`;
        const cached = await CACHE.loadValue(cacheKey);

        if (cached && typeof cached === 'object') {
            const rates = cached as ExchangeRates;
            const now = Date.now();

            // Check if cache is still fresh
            if (rates.timestamp && (now - rates.timestamp) < this.CACHE_DURATION) {
                return rates;
            }
        }

        return null;
    }

    private async fetchExchangeRates(baseCurrency: string): Promise<ExchangeRates | null> {
        if (!this.serverApi) return null;

        try {
            const url = `https://v6.exchangerate-api.com/v6/${this.API_KEY}/latest/${baseCurrency}`;
            
            // fetchNoCors might not support signal/timeout, so we'll rely on its default timeout
            const response = await this.serverApi.fetchNoCors(url, { method: "GET" });

            if (!response.success) {
                console.error("Failed to fetch exchange rates");
                return null;
            }

            // Parse response
            let data: any;
            if (response.result && typeof response.result === 'object' && 'body' in response.result) {
                const bodyStr = (response.result as any).body;
                data = JSON.parse(bodyStr);
            } else if (typeof response.result === 'string') {
                data = JSON.parse(response.result);
            } else {
                data = response.result;
            }

            if (data.result !== "success" || !data.conversion_rates) {
                console.error("Invalid exchange rate response:", data);
                return null;
            }

            const rates: ExchangeRates = {
                base: data.base_code || baseCurrency,
                rates: data.conversion_rates,
                timestamp: Date.now()
            };

            // Cache the rates
            const cacheKey = `${this.CACHE_KEY}_${baseCurrency}`;
            await CACHE.setValue(cacheKey, rates);

            return rates;
        } catch (e: any) {
            console.error("Error fetching exchange rates:", e);
            return null;
        }
    }
}

export const exchangeRateService = new ExchangeRateService();
