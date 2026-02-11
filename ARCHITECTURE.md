# Deckdeals Architecture & Code Overview

Deckdeals is a Decky Loader plugin that enhances the Steam Deck store experience by injecting price history and deal information directly onto game pages.

## Core Components

### 1. `src/index.tsx`
- **Entry Point**: This is the main file loaded by Decky Loader.
- **Responsibilities**:
    - Initializes services (`Settings`, `Cache`, `SteamDBService`).
    - Registers the settings menu item (`DeckyMenuOption`).
    - Activates the `StorePatch` to inject content into store pages.
    - Defines the plugin icon and title.

### 2. `src/patches/StoreInjector.ts`
- **The "Injector"**: This is arguably the most critical component.
- **How it works**:
    - It monitors the Steam Deck UI for navigation events.
    - When the user visits a store page (`/app/<appid>`), it detects the AppID.
    - It checks if the plugin is enabled via `Settings`.
    - It fetches price data using `SteamDBService`.
    - It **injects HTML directly** into the DOM of the store page to display:
        - Current Price
        - Lowest Price (365 days)
        - Price Difference (or "ALL YEAR LOW!")
        - An interactive price history graph
        - Buttons for SteamDB and IsThereAnyDeal
    - It handles user interactions (hovering/tapping on the graph).
    - It formats dates according to the user's `Date Format` setting.

### 3. `src/service/SteamDBService.ts`
- **Data Fetching Layer**: Handles all communication with the IsThereAnyDeal (ITAD) API.
- **Key Functions**:
    - `getITADGameId(appid)`: Resolves a Steam AppID to an ITAD GameID.
    - `getLowestPrice(appid, country)`: Orchestrates the data fetching:
        1. Gets ITAD GameID.
        2. Fetches current price and history from ITAD (using the specific store ID, e.g., Steam).
        3. Returns a structured `PriceData` object.

### 4. `src/components/DeckyMenuOption.tsx`
- **Settings UI**: The React component rendered in the Decky Quick Access Menu.
- **Features**:
    - Toggle to enable/disable the plugin.
    - **Date Format**: Dropdown to select preferred date format (Default, US, EU, ISO).
    - Country selection dropdown (for currency conversion).
    - Store selection (collapsible list) to choose which stores to track.
    - Credits and attribution.

### 5. `src/utils/`
- **`Settings.ts`**: Manages persistent user settings (saved to `settings.json` on the Deck).
- **`Cache.ts`**: A simple in-memory cache to prevent redundant API calls during navigation.
- **`Secrets.ts`**: Stores the public API key for IsThereAnyDeal.

### 6. `src/l10n/`
- **Localization Module**: Provides translation support for all UI strings.
- **`en.ts`**: Default English locale with all string keys.
- **`index.ts`**: Exports `t(key)` helper that resolves strings from the active locale, falling back to English.
- **`template.ts`**: Empty template for contributors to create new translations.

## data Flow

1. **User navigates to a game store page.**
2. `StorePatch` detects the URL change and extracts the `AppID`.
3. `StorePatch` calls `SteamDBService.getLowestPrice(AppID)`.
4. `SteamDBService` calls ITAD API:
    - POST `/v01/game/lookup/id/shop/steam/app/<AppID>` -> Gets `GameID`
    - POST `/v01/game/prices` -> Gets current prices
    - POST `/v01/game/history` -> Gets historical price data
5. `SteamDBService` processes the JSON response and returns a `PriceData` object.
6. `StorePatch` constructs the HTML/CSS for the "Deckdeals" box and appends it to the store page DOM.

## Key Technologies
- **React/TypeScript**: For the settings UI and plugin logic.
- **Decky Frontend Lib**: Provides hooks to interact with the Steam Deck UI (`ServerAPI`, `Router`, etc.).
- **IsThereAnyDeal API**: The backend data source for all price and deal information.
