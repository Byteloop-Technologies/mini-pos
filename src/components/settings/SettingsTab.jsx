import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';
import { printThermalBill } from '../../utils/thermalPrinter';

const CURRENCY_PRESETS = [
  { code: 'USD', symbol: '$', position: 'prefix', decimals: '2', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', position: 'suffix', decimals: '2', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', position: 'prefix', decimals: '2', label: 'GBP (£) - British Pound' },
  { code: 'LKR', symbol: 'Rs.', position: 'prefix', decimals: '2', label: 'LKR (Rs.) - Sri Lankan Rupee' },
  { code: 'INR', symbol: '₹', position: 'prefix', decimals: '2', label: 'INR (₹) - Indian Rupee' },
  { code: 'JPY', symbol: '¥', position: 'prefix', decimals: '0', label: 'JPY (¥) - Japanese Yen' },
  { code: 'AUD', symbol: 'A$', position: 'prefix', decimals: '2', label: 'AUD (A$) - Australian Dollar' },
  { code: 'CAD', symbol: 'C$', position: 'prefix', decimals: '2', label: 'CAD (C$) - Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', position: 'prefix', decimals: '2', label: 'SGD (S$) - Singapore Dollar' },
  { code: 'AED', symbol: 'AED', position: 'prefix', decimals: '2', label: 'AED (AED) - UAE Dirham' },
];

export default function SettingsTab({ products, sales }) {
  const { settings, updateSettings, formatCurrency, currentTheme, setTheme, themes } = useSettings();
  const [formData, setFormData] = useState({ ...settings });
  const [saveStatus, setSaveStatus] = useState('');
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);

  const loadPrinters = useCallback(async () => {
    setLoadingPrinters(true);
    try {
      const list = await api.printer.getList();
      setPrinters(list || []);
    } catch (err) {
      console.warn('Could not list printers:', err);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handlePrintTestBill = async () => {
    setTestingPrinter(true);
    try {
      const testSale = {
        id: 'TEST-01',
        created_at: new Date().toISOString(),
        customer_name: 'Walk-in (Test)',
        payment_method: 'cash',
        cashReceived: 50.0,
        changeDue: 18.2,
        subtotal: 29.44,
        tax: 2.36,
        total: 31.8,
        items: [
          { name: 'Coffee (Beverages)', quantity: 2, price: 2.5 },
          { name: 'Sandwich (Food)', quantity: 1, price: 5.5 },
          { name: 'Cake Slice (Food)', quantity: 2, price: 3.5 },
          { name: 'Thermal Roll Test Item', quantity: 1, price: 14.44 },
        ],
      };
      await printThermalBill(testSale, formData);
      setSaveStatus('Test bill sent to printer!');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      alert(`Print test failed: ${err.message}`);
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleApplyPreset = (preset) => {
    setFormData((prev) => ({
      ...prev,
      currency_code: preset.code,
      currency_symbol: preset.symbol,
      currency_position: preset.position,
      currency_decimals: preset.decimals,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await updateSettings(formData);
      setSaveStatus('Settings successfully saved and applied!');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  // CSV Export utility
  const exportCsv = (filename, rows) => {
    if (!rows || !rows.length) {
      alert('No data available to export.');
      return;
    }
    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [
      headers,
      ...rows.map((r) =>
        Object.values(r)
          .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportProducts = () => {
    exportCsv(`products_${new Date().toISOString().slice(0, 10)}.csv`, products);
  };

  const handleExportSales = () => {
    const flattenedSales = sales.map((s) => ({
      id: s.id,
      date: s.created_at,
      customer: s.customer_name || 'Walk-in',
      payment_method: s.payment_method,
      subtotal: s.subtotal,
      tax: s.tax,
      total: s.total,
      status: s.status || 'completed',
      item_count: s.items?.length || 0,
    }));
    exportCsv(`sales_${new Date().toISOString().slice(0, 10)}.csv`, flattenedSales);
  };

  // Preview amount
  const previewAmount1 = 21.17;
  const previewAmount2 = 1450.0;
  const decimals = parseInt(formData.currency_decimals || '2', 10);
  const sym = formData.currency_symbol || '$';
  const pos = formData.currency_position || 'prefix';
  const sample1 =
    pos === 'suffix'
      ? `${previewAmount1.toLocaleString('en-US', { minimumFractionDigits: decimals })} ${sym}`
      : `${sym}${previewAmount1.toLocaleString('en-US', { minimumFractionDigits: decimals })}`;
  const sample2 =
    pos === 'suffix'
      ? `${previewAmount2.toLocaleString('en-US', { minimumFractionDigits: decimals })} ${sym}`
      : `${sym}${previewAmount2.toLocaleString('en-US', { minimumFractionDigits: decimals })}`;

  return (
    <>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2>ERP System Settings & Configuration</h2>
          {saveStatus && (
            <span className="stock-badge ok" style={{ fontSize: '0.8125rem' }}>
              {saveStatus}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
        <form onSubmit={handleSave} style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* UI Themes & Visual Atmosphere Section */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">UI Theme & Atmosphere</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Select from 5 purpose-built minimal ERP themes for retail, grocery, and office environments
              </span>
            </div>
            <div className="section-content">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px',
                }}
              >
                {(themes || []).map((t) => {
                  const isActive = currentTheme === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      style={{
                        padding: '14px',
                        background: 'var(--bg-card)',
                        border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        transition: 'border-color 150ms ease, transform 150ms ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '0.9375rem' }}>{t.name}</strong>
                          <span className={`stock-badge ${isActive ? 'ok' : 'info'}`} style={{ fontSize: '0.625rem' }}>
                            {isActive ? 'ACTIVE' : t.tag}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                          {t.desc}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                        {/* Swatches preview */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {t.swatches.map((color, idx) => (
                            <span
                              key={idx}
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '3px',
                                background: color,
                                border: '1px solid rgba(0,0,0,0.15)',
                                display: 'inline-block',
                              }}
                              title={color}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '2px 8px', fontSize: '0.6875rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTheme(t.id);
                          }}
                        >
                          {isActive ? 'Current' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Currency Configuration Section */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">Currency & Financial Formatting</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Applied globally to POS terminal, cart, inventory, receipts, and sales reports
              </span>
            </div>
            <div className="section-content">
              {/* Presets */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Quick Currency Presets:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {CURRENCY_PRESETS.map((p) => {
                    const isSelected = formData.currency_code === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleApplyPreset(p)}
                      >
                        {p.code} ({p.symbol})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Currency Code (ISO)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. USD, EUR, GBP, LKR"
                    value={formData.currency_code}
                    onChange={(e) => setFormData({ ...formData, currency_code: e.target.value.toUpperCase() })}
                  />
                  <span className="form-help">International currency code</span>
                </div>

                <div className="form-group">
                  <label>Currency Symbol</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. $, €, £, Rs., ¥"
                    value={formData.currency_symbol}
                    onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                  />
                  <span className="form-help">Symbol rendered in prices</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Symbol Position</label>
                  <select
                    value={formData.currency_position}
                    onChange={(e) => setFormData({ ...formData, currency_position: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                  >
                    <option value="prefix">Prefix (e.g. $21.17 / Rs. 2,500)</option>
                    <option value="suffix">Suffix (e.g. 21.17 € / 2500 JPY)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Decimal Places</label>
                  <select
                    value={formData.currency_decimals}
                    onChange={(e) => setFormData({ ...formData, currency_decimals: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                  >
                    <option value="2">2 Decimals (Standard - 0.00)</option>
                    <option value="0">0 Decimals (e.g. JPY / KRW - 0)</option>
                  </select>
                </div>
              </div>

              {/* Live Preview Box */}
              <div style={{ marginTop: '12px', padding: '12px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Live Format Preview:
                </span>
                <div style={{ display: 'flex', gap: '24px', fontFamily: 'var(--font-data)', fontSize: '1.125rem', fontWeight: 700 }}>
                  <span>Sample 1: {sample1}</span>
                  <span>Sample 2: {sample2}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tax Configuration Section */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">Taxation & Levies</h3>
            </div>
            <div className="section-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Default Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="8.0"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                  />
                  <span className="form-help">Standard rate applied to cart (e.g. 8% default)</span>
                </div>

                <div className="form-group">
                  <label>Tax Name / Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Tax, VAT, GST"
                    value={formData.tax_name}
                    onChange={(e) => setFormData({ ...formData, tax_name: e.target.value })}
                  />
                  <span className="form-help">Displayed on invoice & thermal receipt</span>
                </div>
              </div>
            </div>
          </div>

          {/* Discount & Promotions Controls */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">Discounts & Promotion Controls</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cashier permissions, discount thresholds, and standard presets
              </span>
            </div>
            <div className="section-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Maximum Allowed Discount (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    required
                    placeholder="50"
                    value={formData.max_discount_percent ?? '50'}
                    onChange={(e) => setFormData({ ...formData, max_discount_percent: e.target.value })}
                  />
                  <span className="form-help">Maximum discount rate cashier can apply without manager approval</span>
                </div>
                <div className="form-group">
                  <label>Active Promo Codes & Presets</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    <span className="stock-badge info">MEMBER5 (5%)</span>
                    <span className="stock-badge info">SAVE10 (10%)</span>
                    <span className="stock-badge info">STAFF15 (15%)</span>
                    <span className="stock-badge info">CLEAR20 (20%)</span>
                    <span className="stock-badge info">VIP25 (25%)</span>
                    <span className="stock-badge info">VOUCHER5 ($5)</span>
                  </div>
                  <span className="form-help">Available for one-click selection or promo code entry in POS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Business & Store Profile */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">Store & Receipt Profile</h3>
            </div>
            <div className="section-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Store / Business Name</label>
                  <input
                    type="text"
                    required
                    value={formData.store_name}
                    onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Tax ID / VAT Registration Number</label>
                  <input
                    type="text"
                    value={formData.store_tax_id}
                    onChange={(e) => setFormData({ ...formData, store_tax_id: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Store Telephone</label>
                  <input
                    type="text"
                    value={formData.store_phone}
                    onChange={(e) => setFormData({ ...formData, store_phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Store Physical Address</label>
                  <input
                    type="text"
                    value={formData.store_address}
                    onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Receipt Footer Note</label>
                <input
                  type="text"
                  value={formData.receipt_footer}
                  onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                />
                <span className="form-help">Printed at the bottom of thermal customer receipts</span>
              </div>
            </div>
          </div>

          {/* Thermal Printer & Hardware Billing Section */}
          <div className="section">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 className="section-title">Thermal Printer & Hardware Billing</h3>
                <span className="stock-badge ok" style={{ fontSize: '0.6875rem' }}>
                  ESC/POS READY
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                >
                  {loadingPrinters ? 'Scanning...' : 'Scan Printers'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePrintTestBill}
                  disabled={testingPrinter}
                  title="Send a sample receipt to test thermal printing"
                >
                  {testingPrinter ? 'Sending Test...' : 'Print Test Bill'}
                </button>
              </div>
            </div>
            <div className="section-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Target Thermal Printer</label>
                  <select
                    value={formData.thermal_printer_name || ''}
                    onChange={(e) => setFormData({ ...formData, thermal_printer_name: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                  >
                    <option value="">System Default Printer</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name} {p.isDefault ? '(OS Default)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="form-help">
                    {printers.length > 0 ? `${printers.length} printer(s) detected` : 'No printers detected or using OS default'}
                  </span>
                </div>

                <div className="form-group">
                  <label>Thermal Paper Roll Width</label>
                  <select
                    value={formData.thermal_paper_width || '80mm'}
                    onChange={(e) => setFormData({ ...formData, thermal_paper_width: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                  >
                    <option value="80mm">80mm Roll (Standard POS Receipt - 72mm printable width)</option>
                    <option value="58mm">58mm Roll (Compact / Mobile Thermal - 48mm printable width)</option>
                  </select>
                  <span className="form-help">Adjusts column spacing & font density</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Direct Silent Thermal Printing</label>
                  <select
                    value={formData.thermal_silent_print || 'false'}
                    onChange={(e) => setFormData({ ...formData, thermal_silent_print: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                  >
                    <option value="false">Interactive - Show OS print dialog preview</option>
                    <option value="true">Silent Direct - Send directly to thermal printer without popup</option>
                  </select>
                  <span className="form-help">Recommended 'Silent' for fast POS counter checkouts</span>
                </div>

                <div className="form-group">
                  <label>Auto-Print Receipt on Checkout</label>
                  <select
                    value={formData.thermal_auto_print || 'false'}
                    onChange={(e) => setFormData({ ...formData, thermal_auto_print: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                  >
                    <option value="false">Disabled - Print receipt manually</option>
                    <option value="true">Enabled - Automatically print bill when checkout completes</option>
                  </select>
                  <span className="form-help">Instantly prints bill as soon as sale is committed</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Paper Feed Lines (Before Cut)</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={formData.thermal_feed_lines || '3'}
                    onChange={(e) => setFormData({ ...formData, thermal_feed_lines: e.target.value })}
                  />
                  <span className="form-help">Extra blank lines before paper cutter</span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Backup & Export Section */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">Data Backup & Export</h3>
            </div>
            <div className="section-content" style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportProducts}
              >
                Export Products (CSV)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportSales}
              >
                Export Sales Ledger (CSV)
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 0' }}>
            <button type="submit" className="btn btn-primary" style={{ minWidth: '160px' }}>
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
