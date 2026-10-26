import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';

export default function CustomerLedgerModal({ customer, onClose }) {
  const { formatCurrency } = useSettings();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTxs = useCallback(async () => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const data = await api.customers.getTransactions(customer.id);
      setTransactions(data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    loadTxs();
  }, [loadTxs]);

  if (!customer) return null;

  return (
    <div className="modal-overlay active" role="dialog" aria-modal="true" aria-labelledby="ledgerTitle">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 id="ledgerTitle">Account & Loan Statement: {customer.name}</h3>
            {Number(customer.outstanding_debt || 0) > 0 ? (
              <span className="stock-badge out" style={{ fontWeight: 700 }}>
                Loan Due: {formatCurrency(customer.outstanding_debt)}
              </span>
            ) : (
              <span className="stock-badge ok">
                No Loan Due
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              Loading account statement...
            </p>
          ) : transactions.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              No credit transactions recorded for this customer yet.
            </p>
          ) : (
            <table style={{ width: '100%', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`stock-badge ${
                            tx.type === 'loan_payment' || tx.type === 'topup' || tx.type === 'opening_balance' || tx.type === 'refund'
                              ? 'ok'
                              : 'out'
                          }`}
                          style={{ textTransform: 'uppercase', fontSize: '0.625rem' }}
                        >
                          {tx.type === 'loan_payment' ? 'LOAN PAYMENT' : tx.type === 'sale' ? 'LOAN SALE' : tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.reference || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{tx.notes || '—'}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-data)',
                          fontWeight: 700,
                          color: isPositive ? 'var(--success)' : 'var(--danger)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isPositive ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatCurrency(tx.balance_after)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Credit Facility Limit: <strong>{formatCurrency(customer.credit_limit || 0)}</strong>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
