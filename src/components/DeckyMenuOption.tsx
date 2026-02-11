import { useSettings } from '../hooks/useSettings'
import { DropdownItem, PanelSection, PanelSectionRow, ToggleField } from 'decky-frontend-lib'
import { STORES } from '../utils/Stores';
import { PROVIDERS } from '../utils/Providers';
import { useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { t, getAvailableLocales } from '../l10n';

const DeckyMenuOption = () => {
  const {
    country,
    saveCountry,
    stores,
    toggleStore,
    enabled,
    toggleEnabled,
    dateFormat,
    saveDateFormat,
    showQuickLinks,
    toggleShowQuickLinks,
    providers,
    toggleProvider,
    historyRange,
    saveHistoryRange,
    locale,
    saveLocale,
  } = useSettings();

  const [storesExpanded, setStoresExpanded] = useState(false);
  const [providersExpanded, setProvidersExpanded] = useState(false);

  // Major gaming regions/countries (Expanded)
  const countryOptions = [
    // North America
    { data: "US", label: "United States (US)" },
    { data: "CA", label: "Canada (CA)" },
    { data: "MX", label: "Mexico (MX)" },
    // Europe
    { data: "GB", label: "United Kingdom (GB)" },
    { data: "DE", label: "Germany (DE)" },
    { data: "FR", label: "France (FR)" },
    { data: "ES", label: "Spain (ES)" },
    { data: "IT", label: "Italy (IT)" },
    { data: "PL", label: "Poland (PL)" },
    { data: "NL", label: "Netherlands (NL)" },
    { data: "SE", label: "Sweden (SE)" },
    { data: "NO", label: "Norway (NO)" },
    { data: "CH", label: "Switzerland (CH)" },
    { data: "DK", label: "Denmark (DK)" },
    { data: "FI", label: "Finland (FI)" },
    { data: "AT", label: "Austria (AT)" },
    { data: "CZ", label: "Czech Republic (CZ)" },
    { data: "HU", label: "Hungary (HU)" },
    { data: "RO", label: "Romania (RO)" },
    { data: "UA", label: "Ukraine (UA)" },
    { data: "BE", label: "Belgium (BE)" },
    { data: "PT", label: "Portugal (PT)" },
    { data: "IE", label: "Ireland (IE)" },
    // Asia
    { data: "JP", label: "Japan (JP)" },
    { data: "KR", label: "South Korea (KR)" },
    { data: "CN", label: "China (CN)" },
    { data: "TW", label: "Taiwan (TW)" },
    { data: "HK", label: "Hong Kong (HK)" },
    { data: "IN", label: "India (IN)" },
    { data: "ID", label: "Indonesia (ID)" },
    { data: "MY", label: "Malaysia (MY)" },
    { data: "PH", label: "Philippines (PH)" },
    { data: "SG", label: "Singapore (SG)" },
    { data: "TH", label: "Thailand (TH)" },
    { data: "VN", label: "Vietnam (VN)" },
    // South America
    { data: "BR", label: "Brazil (BR)" },
    { data: "AR", label: "Argentina (AR)" },
    { data: "CL", label: "Chile (CL)" },
    { data: "CO", label: "Colombia (CO)" },
    { data: "PE", label: "Peru (PE)" },
    // Oceania
    { data: "AU", label: "Australia (AU)" },
    { data: "NZ", label: "New Zealand (NZ)" },
    // Middle East / Africa
    { data: "IL", label: "Israel (IL)" },
    { data: "SA", label: "Saudi Arabia (SA)" },
    { data: "AE", label: "United Arab Emirates (AE)" },
    { data: "ZA", label: "South Africa (ZA)" },
    { data: "TR", label: "Turkey (TR)" },
  ];

  const getCurrencyForCountry = (cc: string) => {
    const Mapping: Record<string, string> = {
      "US": "USD", "CA": "CAD", "MX": "USD",
      "GB": "GBP", "PL": "PLN", "JP": "JPY", "KR": "KRW", "CN": "CNY",
      "TW": "TWD", "IN": "INR", "ID": "IDR", "PH": "PHP", "BR": "BRL",
      "AU": "AUD", "NZ": "NZD",
      "DE": "EUR", "FR": "EUR", "ES": "EUR", "IT": "EUR", "NL": "EUR",
      "SE": "EUR", "NO": "EUR", "CH": "EUR", "DK": "EUR", "FI": "EUR",
      "AT": "EUR", "CZ": "EUR", "HU": "EUR", "RO": "EUR", "UA": "EUR",
      "BE": "EUR", "PT": "EUR", "IE": "EUR",
      "HK": "USD", "MY": "USD", "SG": "USD", "TH": "USD", "VN": "USD",
      "AR": "USD", "CL": "USD", "CO": "USD", "PE": "USD", "IL": "USD",
      "SA": "USD", "AE": "USD", "ZA": "USD", "TR": "USD"
    };
    return Mapping[cc] || "USD";
  };

  const getNativeCurrency = (cc: string) => {
    const NativeMapping: Record<string, string> = {
      "NO": "NOK", "CH": "CHF", "DK": "DKK", "FI": "EUR", "SE": "SEK",
      "HK": "HKD", "MY": "MYR", "SG": "SGD", "TH": "THB", "VN": "VND",
      "AR": "ARS", "CL": "CLP", "CO": "COP", "PE": "PEN", "IL": "ILS",
      "SA": "SAR", "AE": "AED", "ZA": "ZAR", "TR": "TRY", "RU": "RUB",
      "MX": "MXN", "UA": "UAH", "CZ": "CZK", "HU": "HUF", "RO": "RON"
    };
    // Default to mapping result if not in native mapping (meaning it likely matches)
    return NativeMapping[cc] || getCurrencyForCountry(cc);
  };

  const selectedStoreNames = STORES.filter(s => stores.includes(s.id)).map(s => s.title);
  const selectedProviderNames = PROVIDERS.filter(p => providers.includes(p.id)).map(p => p.title);
  const currentCurrency = getCurrencyForCountry(country);
  const nativeCurrency = getNativeCurrency(country);
  const showWarning = nativeCurrency !== currentCurrency;
  const currentCountryLabel = countryOptions.find(o => o.data === country)?.label?.split(' (')[0] || country;

  return (
    <>
      <PanelSection title={t("settings.title")}>
        <ToggleField
          label={t("settings.enable.label")}
          description={t("settings.enable.description")}
          checked={enabled}
          onChange={toggleEnabled}
        />
        <ToggleField
          label={t("settings.quickLinks.label")}
          description={t("settings.quickLinks.description")}
          checked={showQuickLinks}
          onChange={toggleShowQuickLinks}
        />

      </PanelSection>

      <PanelSection title={t("settings.stores.title")}>
        <PanelSectionRow>
          <div
            onClick={() => setStoresExpanded(!storesExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              width: '100%',
              padding: '8px 0'
            }}
          >
            <div style={{ marginRight: '8px', fontSize: '12px' }}>
              {storesExpanded ? <FaChevronDown /> : <FaChevronRight />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {t("settings.stores.selected")} ({stores.length})
              </div>
              {!storesExpanded && (
                <div style={{ fontSize: '12px', color: '#8f98a0', marginTop: '2px' }}>
                  {selectedStoreNames.join(', ')}
                </div>
              )}
            </div>
          </div>
        </PanelSectionRow>
        {storesExpanded && STORES.map((store) => (
          <ToggleField
            key={store.id}
            label={store.title}
            checked={stores.includes(store.id)}
            onChange={() => toggleStore(store.id)}
          />
        ))}
      </PanelSection>

      <PanelSection title={t("settings.provider.label")}>
        <PanelSectionRow>
          <div
            onClick={() => setProvidersExpanded(!providersExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              width: '100%',
              padding: '8px 0'
            }}
          >
            <div style={{ marginRight: '8px', fontSize: '12px' }}>
              {providersExpanded ? <FaChevronDown /> : <FaChevronRight />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {t("settings.provider.selected")} ({providers.length})
              </div>
              {!providersExpanded && (
                <div style={{ fontSize: '12px', color: '#8f98a0', marginTop: '2px' }}>
                  {selectedProviderNames.join(', ')}
                </div>
              )}
            </div>
          </div>
        </PanelSectionRow>
        {providersExpanded && PROVIDERS.map((p) => (
          <ToggleField
            key={p.id}
            label={p.title}
            checked={providers.includes(p.id)}
            onChange={() => toggleProvider(p.id)}
          />
        ))}
      </PanelSection>

      <PanelSection title={t("settings.title")}>
        <DropdownItem
          label={t("settings.dateFormat.label")}
          description={t("settings.dateFormat.description")}
          rgOptions={[
            { data: "default", label: t("settings.dateFormat.default") },
            { data: "US", label: t("settings.dateFormat.us") },
            { data: "EU", label: t("settings.dateFormat.eu") },
            { data: "ISO", label: t("settings.dateFormat.iso") },
          ]}
          selectedOption={dateFormat}
          onChange={(option) => saveDateFormat(option.data)}
        />
        <DropdownItem
          label={t("settings.historyRange.label")}
          description={t("settings.historyRange.description")}
          rgOptions={[
            { data: "3m", label: t("settings.historyRange.3m") },
            { data: "6m", label: t("settings.historyRange.6m") },
            { data: "1y", label: t("settings.historyRange.1y") },
            { data: "2y", label: t("settings.historyRange.2y") },
          ]}
          selectedOption={historyRange}
          onChange={(option) => saveHistoryRange(option.data)}
        />
        <DropdownItem
          label={t("settings.country.label")}
          description={t("settings.country.description")}
          rgOptions={countryOptions}
          selectedOption={countryOptions.find(option => option.data === country)?.data}
          onChange={(option) => saveCountry(option.data)}
        ></DropdownItem>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '12px',
          borderRadius: '8px',
          marginTop: '10px',
          fontSize: '12px',
          color: '#8f98a0',
          position: 'relative'
        }}>
          {/* Subtle tail for the bubble */}
          <div style={{
            position: 'absolute',
            top: '-6px',
            left: '10px',
            width: '0',
            height: '0',
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '6px solid rgba(255, 255, 255, 0.05)'
          }} />

          <div style={{ lineHeight: '1.4' }}>
            {t("settings.country.currencyHint").replace("{currency}", currentCurrency)}
            {showWarning && (
              <div style={{ color: '#ffc107', marginTop: '6px', fontSize: '11px', fontWeight: 500 }}>
                {t("settings.country.nativeCurrencyWarning")
                  .replace("{country}", currentCountryLabel)
                  .replace("{native}", nativeCurrency)
                  .replace("{fallback}", currentCurrency)}
              </div>
            )}
          </div>
        </div>
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <div style={{ fontSize: '12px', color: '#8f98a0', textAlign: 'center', padding: '10px 0' }}>
            <div style={{ marginBottom: '8px' }}>
              {t("attribution.line1")}
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              {t("attribution.line2")}
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              {t("attribution.line3")}
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection>
        <DropdownItem
          label={t("settings.language.label")}
          rgOptions={getAvailableLocales()}
          selectedOption={locale}
          onChange={(option) => saveLocale(option.data)}
        />
      </PanelSection>
    </>
  );
}

export default DeckyMenuOption