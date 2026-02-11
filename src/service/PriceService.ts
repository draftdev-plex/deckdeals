import { ServerAPI } from "decky-frontend-lib";
import { SETTINGS, Setting } from "../utils/Settings";
import { STORES } from "../utils/Stores";
import { SECRETS } from "../utils/Secrets";

export interface PriceData {
    lowest: { amount: number; currency: string; date: string; store: string; storeId: number };
    history: { amount: number; date: string; store?: string }[];
    urls: { steamdb: string; itad: string };
}

class PriceService {
    private serverApi: ServerAPI | undefined;
    private readonly API_KEY = SECRETS.ITAD_API_KEY;

    public init(serverApi: ServerAPI) {
        this.serverApi = serverApi;
    }

    public getSteamDBUrl(appId: string): string {
        return `https://steamdb.info/app/${appId}/`;
    }

    /**
     * Try to extract JSON data from a fetchNoCors result.
     * Decky's fetchNoCors can return data in multiple formats:
     *   - { body: "json string" }  (most common)
     *   - raw string
     *   - already-parsed object/array
     */
    private extractJson(result: any): { data: any; rawInfo: string } {
        // Case 1: result has a .body string property → parse it
        if (result && typeof result === 'object' && typeof result.body === 'string') {
            try {
                return { data: JSON.parse(result.body), rawInfo: "parsed from result.body" };
            } catch (e) {
                return { data: null, rawInfo: "result.body parse failed: " + result.body.substring(0, 150) };
            }
        }
        // Case 2: result is a raw JSON string
        if (typeof result === 'string') {
            try {
                return { data: JSON.parse(result), rawInfo: "parsed from string result" };
            } catch (e) {
                return { data: null, rawInfo: "string parse failed: " + result.substring(0, 150) };
            }
        }
        // Case 3: result is already parsed (object or array)
        if (result && typeof result === 'object') {
            return { data: result, rawInfo: "result was already object, keys: " + Object.keys(result).join(",") };
        }
        return { data: null, rawInfo: "unknown result type: " + typeof result };
    }

    public async getLowestPrice(appId: string): Promise<{ data: PriceData | null, error?: string, debug?: any }> {
        if (!this.serverApi) return { data: null, error: "ServerAPI not initialized" };

        const lookupUrl = `https://api.isthereanydeal.com/games/lookup/v1?key=${this.API_KEY}&appid=${appId}`;
        let historyUrl = "";

        try {
            const country = await SETTINGS.load(Setting.COUNTRY) || "US";
            const providers = await SETTINGS.load(Setting.PROVIDERS) || ["itad"];
            const storesArr = await SETTINGS.load(Setting.STORES) || [61];
            const validStores = Array.isArray(storesArr) ? storesArr : [61];
            const shopsParam = validStores.length > 0 ? validStores.join(",") : "61";

            if (!providers.includes("itad")) {
                // For now we only support ITAD, if not selected, we could return null or fallback
                // but user likely expects at least one provider to work if they enabled the plugin.
                // We'll proceed with ITAD for now but could handle other providers here.
            }

            // 1. Lookup Game ID
            // Removed <any> generic type argument to avoid "Untyped function calls..." error
            const lookupRes = await this.serverApi.fetchNoCors(lookupUrl, { method: "GET" });

            if (!lookupRes.success) {
                return { data: null, error: "Lookup fetch failed", debug: { lookupUrl } };
            }

            const lookupParsed = this.extractJson(lookupRes.result);
            const lookupData = lookupParsed.data;

            if (!lookupData || !lookupData.found) {
                return { data: null, error: "Game not found in ITAD (" + lookupParsed.rawInfo + ")", debug: { lookupUrl } };
            }

            const gameId = lookupData.game.id;
            const gameSlug = lookupData.game.slug;

            // 2. Get History
            const since = new Date();
            since.setFullYear(since.getFullYear() - 5);
            // ITAD requires full ISO 8601 format WITHOUT milliseconds (e.g. 2024-02-10T00:00:00Z)
            const sinceStr = encodeURIComponent(since.toISOString().split('.')[0] + "Z");

            historyUrl = `https://api.isthereanydeal.com/games/history/v2?key=${this.API_KEY}&id=${gameId}&country=${country}&shops=${shopsParam}&since=${sinceStr}`;

            // Removed <any> generic type argument to avoid "Untyped function calls..." error
            const historyRes = await this.serverApi.fetchNoCors(historyUrl, { method: "GET" });

            if (!historyRes.success) {
                return { data: null, error: "History fetch failed", debug: { lookupUrl, historyUrl } };
            }

            const historyParsed = this.extractJson(historyRes.result);
            const historyData = historyParsed.data;

            if (!Array.isArray(historyData)) {
                return {
                    data: null,
                    error: "History not array (" + historyParsed.rawInfo + ")",
                    debug: { lookupUrl, historyUrl, historySnippet: JSON.stringify(historyData).substring(0, 200) }
                };
            }
            if (historyData.length === 0) {
                return { data: null, error: "No history entries", debug: { lookupUrl, historyUrl } };
            }

            // Parse deals - history/v2 returns FLAT array:
            // [ { timestamp, shop: { id, name }, deal: { price: { amount, currency }, regular: {...}, cut } }, ... ]
            let lowestPrice = Infinity;
            let lowestEntry: any = null;
            const historyPoints: { amount: number; date: string; store: string }[] = [];

            for (const entry of historyData) {
                const amount = entry.deal?.price?.amount;
                const date = entry.timestamp;
                const storeId = entry.shop?.id || 0;
                const storeName = STORES.find(s => s.id === storeId)?.title || entry.shop?.name || "Unknown";

                if (typeof amount === 'number' && date) {
                    historyPoints.push({ amount, date, store: storeName });

                    if (amount < lowestPrice) {
                        lowestPrice = amount;
                        lowestEntry = entry;
                    }
                }
            }

            historyPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            if (lowestPrice !== Infinity && lowestEntry) {
                const storeId = lowestEntry.shop?.id || 0;
                const store = STORES.find(s => s.id === storeId)?.title || lowestEntry.shop?.name || "Unknown";
                const slug = gameSlug || appId;
                const currency = lowestEntry.deal?.price?.currency || "USD";

                return {
                    data: {
                        lowest: {
                            amount: lowestPrice,
                            currency: currency,
                            date: lowestEntry.timestamp || new Date().toISOString(),
                            store: store,
                            storeId: storeId
                        },
                        history: historyPoints,
                        urls: {
                            steamdb: this.getSteamDBUrl(appId),
                            itad: `https://isthereanydeal.com/game/${slug}/`
                        }
                    },
                    debug: { lookupUrl, historyUrl, entries: historyData.length }
                };
            }

            return { data: null, error: "No valid deals in history", debug: { lookupUrl, historyUrl } };

        } catch (e) {
            console.error(e);
            return { data: null, error: "Exception: " + e, debug: { lookupUrl, historyUrl } };
        }
    }
}

export const priceService = new PriceService();
