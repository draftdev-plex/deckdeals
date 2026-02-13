// =============================================================================
// Deckdeals Translation Template
// =============================================================================
//
// How to contribute a translation:
//
//   1. Copy this file and rename it to your language code (e.g. de.ts, fr.ts, es.ts).
//   2. Fill in the empty strings with your translations.
//   3. Import your file in src/l10n/index.ts and add it to the `locales` map.
//   4. Submit a pull request!
//
// Notes:
//   - Do NOT change the keys (left side), only fill in the values (right side).
//   - Country names and store names are not translated (they are proper nouns).
//   - Keep translations concise — the Steam Deck screen is small.
//
// =============================================================================

export const LANG_CODE: Record<string, string> = {
    "language.name": "",
    // Settings UI
    "settings.title": "",
    "settings.enable.label": "",
    "settings.enable.description": "",
    "settings.dateFormat.label": "",
    "settings.dateFormat.description": "",
    "settings.dateFormat.default": "",
    "settings.dateFormat.us": "",
    "settings.dateFormat.eu": "",
    "settings.dateFormat.iso": "",
    "settings.country.label": "",
    "settings.country.description": "",
    "settings.country.currencyHint": "",
    "settings.country.nativeCurrencyWarning": "",
    "settings.historyRange.label": "",
    "settings.historyRange.description": "",
    "settings.historyRange.3m": "",
    "settings.historyRange.6m": "",
    "settings.historyRange.1y": "",
    "settings.historyRange.2y": "",
    "settings.stores.title": "",
    "settings.stores.selected": "",
    "settings.stores.currencyReturns": "",
    "settings.stores.currencyUnknown": "",
    "settings.stores.currencyStatus.native": "",
    "settings.stores.currencyStatus.nonNative": "",
    "settings.stores.currencyStatus.mixed": "",
    "settings.stores.howItWorksLabel": "",
    "settings.stores.howItWorksBody1": "",
    "settings.stores.howItWorksBody2": "",
    "settings.stores.howItWorksBody3": "",
    "attribution.title": "",
    "attribution.line1": "",
    "attribution.line2": "",
    "attribution.line3": "",
    "attribution.line4": "",
    "settings.quickLinks.label": "",
    "settings.quickLinks.description": "",
    "settings.provider.label": "",
    "settings.provider.description": "",
    "settings.provider.selected": "",
    "settings.provider.itad": "",

    // Store page (injected into Steam browser)
    "store.title": "",
    "store.currentPrice": "",
    "store.lowestPrice": "",
    "store.loading": "",
    "store.loadingGraph": "",
    "store.dataUnavailable": "",
    "store.noData": "",
    "store.allYearLow": "",
    "store.cheaper": "",
    "store.notEnoughHistory": "",
    "store.hoverOn": "",
    "store.predictedSaleDateOnly": "",
    "store.predictionSubtext": "",
    "store.historyDisclaimer": "",
    "store.expandDeckDeals": "",
    "store.freeGame": "",
    "store.graphHoverPrompt": "",
    "settings.language.label": "",
};
