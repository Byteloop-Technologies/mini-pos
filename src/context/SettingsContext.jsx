import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export const THEMES = [
  {
    id: 'slate',
    name: 'Slate Enterprise',
    tag: 'DEFAULT',
    desc: 'Minimal high-contrast slate & monochrome cleanroom',
    primaryColor: '#202632',
    swatches: ['#f5f6f8', '#ffffff', '#202632', '#146b43', '#dce0e6'],
  },
  {
    id: 'dark',
    name: 'Obsidian Dark',
    tag: 'NIGHT',
    desc: 'Deep terminal black with luminous contrast for evening retail',
    primaryColor: '#60a5fa',
    swatches: ['#0f1319', '#181d26', '#f1f4f9', '#4ade80', '#2c3647'],
  },
  {
    id: 'navy',
    name: 'Nordic Navy',
    tag: 'CORPORATE',
    desc: 'Executive financial blue palette inspired by enterprise ERP suites',
    primaryColor: '#0d3559',
    swatches: ['#f0f4f9', '#ffffff', '#0d3559', '#0b6941', '#c6d6e5'],
  },
  {
    id: 'emerald',
    name: 'Emerald Botanical',
    tag: 'ORGANIC',
    desc: 'Natural forest and sage tints for groceries, pharmacies & fresh food',
    primaryColor: '#15472b',
    swatches: ['#f2f7f4', '#ffffff', '#15472b', '#15803d', '#c3d9c7'],
  },
  {
    id: 'amber',
    name: 'Amber Industrial',
    tag: 'CRAFT',
    desc: 'Warm raw craft palette tailored for coffee shops, bakeries & boutiques',
    primaryColor: '#945307',
    swatches: ['#f8f6f2', '#ffffff', '#2d261e', '#945307', '#dad2c3'],
  },
];

const defaultSettings = {
  currency_code: 'USD',
  currency_symbol: '$',
  currency_position: 'prefix',
  currency_decimals: '2',
  tax_rate: '8',
  tax_name: 'Sales Tax',
  tax_mode: 'exclusive',
  store_name: 'MINI POS ERP',
  store_phone: '+1 (555) 012-3456',
  store_address: '100 Enterprise Way, Suite 400',
  store_tax_id: 'US-TAX-84920',
  receipt_header: 'TAX INVOICE / RECEIPT',
  receipt_footer: 'Thank you for your business. Please retain receipt for returns.',
  low_stock_threshold: '5',
  ui_theme: 'slate',
};

const SettingsContext = createContext({
  settings: defaultSettings,
  loading: true,
  formatCurrency: (val) => `$${Number(val || 0).toFixed(2)}`,
  updateSettings: async () => {},
  reloadSettings: async () => {},
  setTheme: () => {},
  currentTheme: 'slate',
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('pos_theme') : null;
    return {
      ...defaultSettings,
      ui_theme: savedTheme || 'slate',
    };
  });
  const [loading, setLoading] = useState(true);

  // Apply theme to document root
  useEffect(() => {
    const activeTheme = settings.ui_theme || 'slate';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', activeTheme);
      localStorage.setItem('pos_theme', activeTheme);
    }
  }, [settings.ui_theme]);

  const reloadSettings = useCallback(async () => {
    try {
      const data = await api.settings.get();
      if (data) {
        setSettings((prev) => {
          const nextTheme = data.ui_theme || prev.ui_theme || 'slate';
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', nextTheme);
          }
          return { ...prev, ...data, ui_theme: nextTheme };
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const updateSettings = useCallback(async (newValues) => {
    try {
      const updated = await api.settings.update(newValues);
      setSettings((prev) => ({ ...prev, ...updated }));
      if (newValues.ui_theme && typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newValues.ui_theme);
        localStorage.setItem('pos_theme', newValues.ui_theme);
      }
      return updated;
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  }, []);

  const setTheme = useCallback((themeId) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themeId);
      localStorage.setItem('pos_theme', themeId);
    }
    setSettings((prev) => ({ ...prev, ui_theme: themeId }));
    updateSettings({ ui_theme: themeId }).catch((err) => {
      console.warn('Could not persist theme to DB:', err);
    });
  }, [updateSettings]);

  const formatCurrency = useCallback((amount) => {
    const num = Number(amount);
    const validNum = Number.isFinite(num) ? num : 0;
    const decimals = parseInt(settings.currency_decimals ?? '2', 10);
    const symbol = settings.currency_symbol || '$';
    const position = settings.currency_position || 'prefix';

    const formattedNumber = validNum.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    if (position === 'suffix') {
      return `${formattedNumber} ${symbol}`.trim();
    }
    return `${symbol}${formattedNumber}`;
  }, [settings.currency_decimals, settings.currency_symbol, settings.currency_position]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        formatCurrency,
        updateSettings,
        reloadSettings,
        setTheme,
        currentTheme: settings.ui_theme || 'slate',
        themes: THEMES,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
