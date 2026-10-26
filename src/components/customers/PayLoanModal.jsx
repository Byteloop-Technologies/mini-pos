import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';
import { printLoanPaymentReceipt } from '../../utils/thermalPrinter';

export default function PayLoanModal({ customer, onClose, onSuccess }) {
  const { settings, formatCurrency } = useSettings();
  const currentDebt = Number(customer?.outstanding_debt || 0);

  const [amount, setAmount] = useState(currentDebt > 0 ? currentDebt.toFixed(2) : '');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState(`LPAY-${Math.floor(1000 + Math.random() * 9000)}`);
  const [notes, setNotes] = useState('');
  const [autoPrint, setAutoPrint] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!customer) return null;

  const handleQuickAmount = (val) => {
    if (val === 'full') {
      setAmount(currentDebt.toFixed(2));
    } else if (val === 'half') {
      setAmount((currentDebt / 2).toFixed(2));
    } else {
      setAmount(Number(val).toFixed(2));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payNum = parseFloat(amount);
    if (!Number.isFinite(payNum) || payNum <= 0) {
      alert('Please enter a valid positive repayment amount.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.customers.payLoan({
        customerId: customer.id,
        amount: payNum,
        paymentMethod,
        reference: reference || `LPAY-${Date.now().toString().slice(-4)}`,
        notes: notes || `Loan repayment via ${paymentMethod.toUpperCase()}`,
      });

      if (autoPrint) {
        await printLoanPaymentReceipt({
          ...result,
          customerName: customer.name,
          customerPhone: customer.phone,
          previousDebt: currentDebt,
          amountPaid: payNum,
          remainingDebt: Math.max(0, currentDebt - payNum),
          paymentMethod,
          notes,
        }, settings);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      alert(`Loan payment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const projectedRemainingDebt = Math.max(0, currentDebt - parsedAmount);

  return (
    <div className="modal-overlay active" role="dialog" aria-modal="true" aria-labelledby="payLoanTitle">
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 id="payLoanTitle">Settle Customer Loan</h3>
            <span className="stock-badge info">{customer.name}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Loan Status Card */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                padding: '12px',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Current Outstanding Loan
                </span>
                <strong
                  style={{
                    fontFamily: 'var(--font-data)',
                    color: currentDebt > 0 ? 'var(--danger)' : 'var(--success)',
                    fontSize: '1.0625rem',
                  }}
                >
                  {formatCurrency(currentDebt)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Amount Repaying
                </span>
                <strong
                  style={{
                    fontFamily: 'var(--font-data)',
                    color: 'var(--accent)',
                    fontSize: '1.0625rem',
                  }}
                >
                  {formatCurrency(parsedAmount)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Remaining Debt After
                </span>
                <strong
                  style={{
                    fontFamily: 'var(--font-data)',
                    color: projectedRemainingDebt === 0 ? 'var(--success)' : 'var(--text)',
                    fontSize: '1.0625rem',
                  }}
                >
                  {formatCurrency(projectedRemainingDebt)}
                </strong>
              </div>
            </div>

            {/* Quick Settle Presets */}
            {currentDebt > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Quick Settle Presets:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    onClick={() => handleQuickAmount('full')}
                  >
                    Pay Full Due ({formatCurrency(currentDebt)})
                  </button>
                  {currentDebt > 10 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => handleQuickAmount('half')}
                    >
                      Pay 50% ({formatCurrency(currentDebt / 2)})
                    </button>
                  )}
                  {[10, 20, 50, 100].filter((v) => v < currentDebt).map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => handleQuickAmount(val)}
                    >
                      {formatCurrency(val)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Repayment Amount */}
            <div className="form-group">
              <label htmlFor="repayAmount">
                Payment Amount ({settings.currency_symbol || '$'}) *
              </label>
              <input
                id="repayAmount"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="form-control"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label>Payment Tender Received</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {['cash', 'card', 'bank_transfer', 'mobile'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn btn-sm ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ textTransform: 'uppercase', fontSize: '0.6875rem', padding: '6px 4px' }}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference */}
            <div className="form-group">
              <label htmlFor="payRef">Reference / Receipt Slip #</label>
              <input
                id="payRef"
                type="text"
                className="form-control"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="payNotes">Notes / Ledger Remarks</label>
              <input
                id="payNotes"
                type="text"
                className="form-control"
                placeholder="e.g. Loan settlement for grocery invoice"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Auto Print Thermal Receipt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <input
                id="autoPrintLoan"
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
              />
              <label htmlFor="autoPrintLoan" style={{ margin: 0, fontSize: '0.8125rem', cursor: 'pointer' }}>
                Print Official Thermal Repayment Receipt / Voucher
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Recording...' : `Record Payment (${formatCurrency(parsedAmount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
