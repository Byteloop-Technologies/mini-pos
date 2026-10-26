import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

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
};

const SettingsContext = createContext({
  settings: defaultSettings,
  loading: true,
  formatCurrency: (val) => `$${Number(val || 0).toFixed(2)}`,
  updateSettings: async () => {},
  reloadSettings: async () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  const reloadSettings = useCallback(async () => {
    try {
      const data = await api.settings.get();
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
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
      return updated;
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  }, []);

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
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
