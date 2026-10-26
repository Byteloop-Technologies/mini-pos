import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';

export default function AddCreditModal({ customer, onClose, onSuccess }) {
  const { formatCurrency } = useSettings();
  const [actionType, setActionType] = useState('topup'); // 'topup' or 'payment' or 'deduct'
  const [amount, setAmount] = useState('');
  const [paymentTender, setPaymentTender] = useState('cash');
  const [reference, setReference] = useState(`DEP-${Math.floor(1000 + Math.random() * 9000)}`);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!customer) return null;

  const currentBalance = Number(customer.credit_balance || 0);
  const creditLimit = Number(customer.credit_limit || 0);
  const availableCredit = currentBalance + creditLimit;

  const handleQuickAmount = (val) => {
    setAmount(String(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    setLoading(true);
    try {
      if (actionType === 'deduct') {
        await api.customers.deductCredit({
          customerId: customer.id,
          amount: num,
          type: 'adjustment',
          reference: reference || 'Manual Debit',
          notes: notes || `Manual deduction (${paymentTender})`,
        });
      } else {
        await api.customers.addCredit({
          customerId: customer.id,
          amount: num,
          type: actionType,
          reference: reference || (actionType === 'payment' ? 'Account Payment' : 'Store Credit Deposit'),
          notes: notes ? `${notes} (${paymentTender.toUpperCase()})` : `Received via ${paymentTender.toUpperCase()}`,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      alert(`Transaction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay active" role="dialog" aria-modal="true" aria-labelledby="addCreditTitle">
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 id="addCreditTitle">Add Customer Credit</h3>
            <span className="stock-badge info">{customer.name}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Account Summary Banner */}
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
                  Current Balance
                </span>
                <strong
                  style={{
                    fontFamily: 'var(--font-data)',
                    color: currentBalance >= 0 ? 'var(--success)' : 'var(--danger)',
                    fontSize: '1rem',
                  }}
                >
                  {formatCurrency(currentBalance)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Credit Limit
                </span>
                <strong style={{ fontFamily: 'var(--font-data)', fontSize: '1rem' }}>
                  {formatCurrency(creditLimit)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Available Credit
                </span>
                <strong style={{ fontFamily: 'var(--font-data)', fontSize: '1rem' }}>
                  {formatCurrency(availableCredit)}
                </strong>
              </div>
            </div>

            <div className="form-group">
              <label>Transaction Type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
              >
                <option value="topup">Store Credit Top-up / Prepayment (+)</option>
                <option value="payment">Account Debt Settlement Payment (+)</option>
                <option value="deduct">Manual Debit / Charge Adjustment (-)</option>
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>Credit Amount *</label>
                {/* Quick amount chips */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[10, 25, 50, 100, 250].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.6875rem' }}
                      onClick={() => handleQuickAmount(val)}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                style={{ font: '600 1.125rem var(--font-data)' }}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Payment Tender</label>
                <select
                  value={paymentTender}
                  onChange={(e) => setPaymentTender(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                >
                  <option value="cash">Cash Tender</option>
                  <option value="card">Card / Terminal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label>Reference Code</label>
                <input
                  type="text"
                  placeholder="Receipt / Slip #"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Transaction Notes / Reason</label>
              <input
                type="text"
                placeholder="e.g. Deposit for monthly account, advance payment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : actionType === 'deduct' ? 'Deduct Credit' : 'Add Credit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
