import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { printThermalBill, generateBarcodeSvg } from '../../utils/thermalPrinter';

export default function ReceiptModal({ sale, onClose }) {
  const { settings, formatCurrency } = useSettings();
  const [printing, setPrinting] = useState(false);
  const [paperWidth, setPaperWidth] = useState(settings.thermal_paper_width || '80mm');

  if (!sale) return null;

  const isDraft = Boolean(sale.isDraft);
  const billTitle = isDraft ? 'Proforma Bill' : `Receipt #${sale.id}`;
  const formattedDate = sale.created_at
    ? new Date(sale.created_at).toLocaleString()
    : new Date().toLocaleString();

  const handleThermalPrint = async () => {
    setPrinting(true);
    try {
      await printThermalBill(sale, {
        ...settings,
        thermal_paper_width: paperWidth,
      });
    } catch (err) {
      alert(`Print error: ${err.message}`);
    } finally {
      setPrinting(false);
    }
  };

  const handleSystemPrint = () => {
    window.print();
  };

  const billBarcodeCode = sale.id
    ? (isDraft ? `DRAFT-${sale.id}` : `INV-${sale.id}`)
    : 'BILL-0001';

  return (
    <div className="modal-overlay active" role="dialog" aria-modal="true" aria-labelledby="receiptTitle">
      <div className="modal modal-lg receipt-modal-dialog">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 id="receiptTitle">{billTitle}</h3>
            <span className={`stock-badge ${isDraft ? 'warning' : 'ok'}`}>
              {isDraft ? 'UNPAID / ESTIMATE' : 'PAID'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Paper width selector */}
            <select
              value={paperWidth}
              onChange={(e) => setPaperWidth(e.target.value)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-muted)',
              }}
              title="Select thermal receipt paper width"
            >
              <option value="80mm">80mm Thermal</option>
              <option value="58mm">58mm Thermal</option>
            </select>
            <button className="modal-close" onClick={onClose} aria-label="Close modal">
              &times;
            </button>
          </div>
        </div>

        <div className="modal-body receipt-body">
          <div
            className="thermal-receipt"
            id="printableReceiptArea"
            style={{
              maxWidth: paperWidth === '58mm' ? '280px' : '400px',
              transition: 'max-width 150ms ease',
            }}
          >
            <div className="receipt-header-area">
              <h2 className="receipt-store-name">{settings.store_name}</h2>
              {settings.store_address && <p className="receipt-subtext">{settings.store_address}</p>}
              {settings.store_phone && <p className="receipt-subtext">Tel: {settings.store_phone}</p>}
              {settings.store_tax_id && (
                <p className="receipt-subtext">Tax ID / VAT: {settings.store_tax_id}</p>
              )}
              <div className="receipt-divider-dashed" />
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.8125rem', margin: '4px 0' }}>
                {isDraft ? '*** PROFORMA BILL / ORDER SLIP ***' : `*** ${settings.receipt_header || 'TAX INVOICE'} ***`}
              </div>
              <div className="receipt-meta-row">
                <span>BILL #{sale.id || 'DRAFT'}</span>
                <span>{formattedDate}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Payment: {sale.payment_method ? sale.payment_method.toUpperCase() : (isDraft ? 'PENDING' : 'CASH')}</span>
                <span>Customer: {sale.customer_name || 'Walk-in'}</span>
              </div>
              <div className="receipt-divider-dashed" />
            </div>

            <table className="receipt-items-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(sale.items || []).map((item, idx) => {
                  const qty = item.quantity || 1;
                  const price = item.price || 0;
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: 'left' }}>{item.productName || item.name}</td>
                      <td style={{ textAlign: 'center' }}>{qty}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(price * qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="receipt-divider-dashed" />

            <div className="receipt-totals-area">
              <div className="receipt-total-line">
                <span>Subtotal:</span>
                <span>{formatCurrency(sale.subtotal ?? (sale.total / 1.08))}</span>
              </div>
              {sale.discount > 0 && (
                <div className="receipt-total-line">
                  <span>Discount:</span>
                  <span>-{formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div className="receipt-total-line">
                <span>{settings.tax_name} ({settings.tax_rate}%):</span>
                <span>{formatCurrency(sale.tax ?? (sale.total - (sale.total / 1.08)))}</span>
              </div>
              <div className="receipt-total-line grand-total">
                <span>TOTAL DUE:</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
              {sale.cashReceived && (
                <>
                  <div className="receipt-total-line">
                    <span>Cash Tendered:</span>
                    <span>{formatCurrency(sale.cashReceived)}</span>
                  </div>
                  <div className="receipt-total-line" style={{ fontWeight: 'bold' }}>
                    <span>Change Due:</span>
                    <span>{formatCurrency(sale.changeDue)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="receipt-divider-dashed" />

            {/* Barcode representation */}
            <div
              dangerouslySetInnerHTML={{
                __html: generateBarcodeSvg(billBarcodeCode),
              }}
            />

            <div className="receipt-footer-area">
              <p>{settings.receipt_footer}</p>
              <p style={{ marginTop: '4px', fontSize: '0.625rem' }}>POS Terminal #01</p>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <span>Printer: <strong>{settings.thermal_printer_name || 'System Default'}</strong> ({paperWidth})</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSystemPrint}
              title="Print via standard Windows OS print dialog"
            >
              OS Print
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={printing}
              onClick={handleThermalPrint}
              title="Direct thermal printer billing"
            >
              {printing ? 'Printing...' : 'Print Thermal Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
