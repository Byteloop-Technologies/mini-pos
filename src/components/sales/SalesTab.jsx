import React, { useState, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';
import ReceiptModal from '../pos/ReceiptModal';

export default function SalesTab({ sales, onRefresh }) {
  const { settings, formatCurrency } = useSettings();
  const [selectedSale, setSelectedSale] = useState(null);
  const [refundSale, setRefundSale] = useState(null);
  const [printBillSale, setPrintBillSale] = useState(null);
  const [refundReason, setRefundReason] = useState('Customer return');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const matchMethod = filterMethod === 'all' || s.payment_method === filterMethod;
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'refunded' ? s.status === 'refunded' : s.status !== 'refunded');
      return matchMethod && matchStatus;
    });
  }, [sales, filterMethod, filterStatus]);

  const handleProcessRefund = async () => {
    if (!refundSale) return;
    try {
      await api.sales.refund(refundSale.id, refundReason);
      setRefundSale(null);
      setRefundReason('Customer return');
      onRefresh();
    } catch (err) {
      alert(`Refund failed: ${err.message}`);
    }
  };

  return (
    <>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2>Sales History</h2>
          <span className="stat-item">{sales.length} transactions</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
          >
            <option value="all">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile">Mobile</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table id="salesTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Items</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Payment</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody id="salesTableBody">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    No sales recorded
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => {
                  const isRefunded = sale.status === 'refunded';
                  const dateStr = new Date(sale.created_at).toLocaleString();
                  const totalItems = sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

                  return (
                    <tr key={sale.id} style={{ opacity: isRefunded ? 0.75 : 1 }}>
                      <td style={{ fontFamily: 'var(--font-data)' }}>
                        #{sale.id}
                        {isRefunded && (
                          <span className="stock-badge out" style={{ marginLeft: '6px', fontSize: '0.625rem' }}>
                            REFUNDED
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>{dateStr}</td>
                      <td>{totalItems}</td>
                      <td>
                        <strong style={{ textDecoration: isRefunded ? 'line-through' : 'none' }}>
                          {formatCurrency(sale.total)}
                        </strong>
                      </td>
                      <td>
                        <span className="stock-badge ok" style={{ textTransform: 'uppercase' }}>
                          {sale.payment_method}
                        </span>
                        {sale.customer_name && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            {sale.customer_name}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => setSelectedSale(sale)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => setPrintBillSale(sale)}
                            title="Print thermal bill"
                          >
                            Print Bill
                          </button>
                          {!isRefunded && (
                            <button
                              type="button"
                              className="action-btn delete"
                              onClick={() => setRefundSale(sale)}
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div
          className="modal-overlay active"
          id="saleDetailModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="saleDetailTitle"
        >
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 id="saleDetailTitle">Sale #{selectedSale.id} Details</h3>
              <button
                type="button"
                className="modal-close"
                id="closeSaleModal"
                onClick={() => setSelectedSale(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <div className="sale-detail modal-body" id="saleDetailContent">
              <div className="sale-header">
                <div className="sale-meta">
                  <span><strong>Date:</strong> {new Date(selectedSale.created_at).toLocaleString()}</span>
                  <span><strong>Payment:</strong> {selectedSale.payment_method?.toUpperCase()}</span>
                  <span><strong>Status:</strong> {selectedSale.status || 'completed'}</span>
                  {selectedSale.customer_name && (
                    <span><strong>Customer:</strong> {selectedSale.customer_name}</span>
                  )}
                  {selectedSale.notes && (
                    <span><strong>Notes:</strong> {selectedSale.notes}</span>
                  )}
                </div>
              </div>

              <table className="sale-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSale.items || []).map((item, index) => (
                    <tr key={index}>
                      <td>{item.name || item.productName}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="sale-total">
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Subtotal: {formatCurrency(selectedSale.subtotal || (selectedSale.total / 1.08))}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Tax ({settings.tax_rate}%): {formatCurrency(selectedSale.tax || (selectedSale.total - (selectedSale.total / 1.08)))}
                </div>
                <div>
                  Total: <strong>{formatCurrency(selectedSale.total)}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setPrintBillSale(selectedSale);
                }}
              >
                Print Thermal Bill
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedSale(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt / Bill Modal */}
      {printBillSale && (
        <ReceiptModal
          sale={printBillSale}
          onClose={() => setPrintBillSale(null)}
        />
      )}

      {/* Refund Confirmation Modal */}
      {refundSale && (
        <div className="modal-overlay active" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Process Refund for Sale #{refundSale.id}</h3>
              <button className="modal-close" onClick={() => setRefundSale(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                Refunding will restore all {refundSale.items?.reduce((s, i) => s + i.quantity, 0)} item(s) back into stock and mark the invoice as refunded.
              </p>
              <div className="form-group">
                <label>Refund Reason</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Defective item, customer return"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRefundSale(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleProcessRefund}
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
