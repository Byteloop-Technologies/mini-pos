import React from 'react';
import { useSettings } from '../../context/SettingsContext';

export default function Header({ activeTab, onSelectTab, stats }) {
  const { settings, formatCurrency, currentTheme, setTheme, themes } = useSettings();

  const tabs = [
    { id: 'pos', label: 'POS' },
    { id: 'products', label: 'Products' },
    { id: 'sales', label: 'Sales' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'customers', label: 'Customers' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'settings', label: 'Settings' },
  ];

  const lowStock = stats?.lowStockCount ?? 0;
  const todayTotal = stats?.todayTotal ?? 0;
  const totalProducts = stats?.totalProducts ?? 0;

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">{settings.store_name || 'Mini POS'}</h1>
        <nav className="tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              role="tab"
              data-tab={tab.id}
              aria-selected={activeTab === tab.id}
              onClick={() => onSelectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="header-right">
        <div className="stats-bar" id="statsBar">
          <span className="stat-item">
            Products: <strong>{totalProducts}</strong>
          </span>
          <span className={`stat-item ${lowStock > 0 ? 'warning' : ''}`}>
            Low Stock: <strong>{lowStock}</strong>
          </span>
          <span className="stat-item">
            Today: <strong>{formatCurrency(todayTotal)}</strong>
          </span>
          <span className="stat-item">
            Currency: <strong>{settings.currency_code} ({settings.currency_symbol})</strong>
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Theme:
            </span>
            <select
              value={currentTheme}
              onChange={(e) => setTheme(e.target.value)}
              aria-label="Select UI Theme"
              style={{
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-muted)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {(themes || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
