import React, { useState, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';
import AddCreditModal from './AddCreditModal';
import PayLoanModal from './PayLoanModal';
import CustomerLedgerModal from './CustomerLedgerModal';

export default function CustomersTab({ customers, onRefresh }) {
  const { formatCurrency } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [creditCustomer, setCreditCustomer] = useState(null);
  const [payLoanCustomer, setPayLoanCustomer] = useState(null);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    credit_balance: '0',
    credit_limit: '0',
    outstanding_debt: '0',
  });

  // Calculate high-level Loan / Udhar KPIs
  const kpis = useMemo(() => {
    let totalLoanDue = 0;
    let debtorsCount = 0;
    for (const c of customers) {
      const debt = Number(c.outstanding_debt || 0);
      if (debt > 0) {
        totalLoanDue += debt;
        debtorsCount += 1;
      }
    }
    return {
      totalLoanDue,
      debtorsCount,
      totalCustomers: customers.length,
    };
  }, [customers]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      id: '',
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      credit_balance: '0',
      credit_limit: '0',
      outstanding_debt: '0',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCustomer(c);
    setFormData({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
      credit_balance: String(c.credit_balance ?? '0'),
      credit_limit: String(c.credit_limit ?? '0'),
      outstanding_debt: String(c.outstanding_debt ?? '0'),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this customer account?')) {
      try {
        await api.customers.delete(id);
        onRefresh();
      } catch (err) {
        alert(`Failed to delete customer: ${err.message}`);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.customers.update({
          ...formData,
          id: Number(formData.id),
          credit_limit: parseFloat(formData.credit_limit) || 0,
          outstanding_debt: parseFloat(formData.outstanding_debt) || 0,
        });
      } else {
        await api.customers.create({
          ...formData,
          credit_balance: parseFloat(formData.credit_balance) || 0,
          credit_limit: parseFloat(formData.credit_limit) || 0,
          outstanding_debt: parseFloat(formData.outstanding_debt) || 0,
        });
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      alert(`Failed to save customer: ${err.message}`);
    }
  };

  return (
    <>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2>Customer Directory & Store Loans</h2>
          <span className="stat-item">{customers.length} registered</span>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          Add Customer
        </button>
      </div>

      {/* Loan & Debt Market Summary Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Total Items Given on Loan (Market Debt)
          </span>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'var(--font-data)',
              color: kpis.totalLoanDue > 0 ? 'var(--danger)' : 'var(--text)',
              marginTop: '2px',
            }}
          >
            {formatCurrency(kpis.totalLoanDue)}
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Total money owed by customers to shop
          </span>
        </div>

        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Customers with Unpaid Loans
          </span>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'var(--font-data)',
              color: kpis.debtorsCount > 0 ? 'var(--warning)' : 'var(--success)',
              marginTop: '2px',
            }}
          >
            {kpis.debtorsCount} {kpis.debtorsCount === 1 ? 'Customer' : 'Customers'}
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Active loan debtors awaiting payment
          </span>
        </div>

        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            Registered Accounts
          </span>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'var(--font-data)',
              color: 'var(--text)',
              marginTop: '2px',
            }}
          >
            {kpis.totalCustomers} Accounts
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Authorized credit accounts in database
          </span>
        </div>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone / Email</th>
                <th>Address</th>
                <th style={{ textAlign: 'right' }}>Outstanding Loan (Due)</th>
                <th style={{ textAlign: 'right' }}>Loan Limit</th>
                <th style={{ textAlign: 'right' }}>Total Orders</th>
                <th style={{ textAlign: 'right' }}>Total Spend</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    No customers registered
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const debt = Number(c.outstanding_debt || 0);
                  const limit = Number(c.credit_limit || 0);
                  const hasDebt = debt > 0;

                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        {c.notes && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            {c.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{c.phone || '—'}</div>
                        {c.email && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            {c.email}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>{c.address || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {hasDebt ? (
                          <span
                            className="stock-badge out"
                            style={{ fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            title="Items taken on loan. Payment due."
                          >
                            DUE: {formatCurrency(debt)}
                          </span>
                        ) : (
                          <span className="stock-badge ok" style={{ fontSize: '0.6875rem' }}>
                            NO DEBT
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)' }}>
                        {limit > 0 ? formatCurrency(limit) : 'No Limit'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)' }}>
                        {c.total_orders || 0}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)' }}>
                        <strong>{formatCurrency(c.total_spent || 0)}</strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${hasDebt ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '3px 8px', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}
                            onClick={() => setPayLoanCustomer(c)}
                            title="Record loan repayment (after payment)"
                          >
                            Settle Loan
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => setLedgerCustomer(c)}
                            title="View customer loan statement & transactions ledger"
                          >
                            Ledger
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => setCreditCustomer(c)}
                            title="Advance credit top-up"
                          >
                            + Credit
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => handleOpenEdit(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn delete"
                            onClick={() => handleDelete(c.id)}
                          >
                            Delete
                          </button>
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

      {/* Customer Modal (Create / Edit) */}
      {modalOpen && (
        <div className="modal-overlay active" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name / Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Smith or Acme Corp"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +1 (555) 019-2834"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. customer@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Opening Loan / Debt Balance</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.outstanding_debt}
                      onChange={(e) => setFormData({ ...formData, outstanding_debt: e.target.value })}
                    />
                    <span className="form-help">Current amount owed to shop (if any)</span>
                  </div>

                  <div className="form-group">
                    <label>Loan / Credit Limit</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    />
                    <span className="form-help">Maximum allowed loan (0 = no limit)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Billing / Delivery Address</label>
                  <input
                    type="text"
                    placeholder="Street, City, Postcode"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Customer Notes / Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. Trusted customer, Net 15 days payment"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Loan Modal */}
      {payLoanCustomer && (
        <PayLoanModal
          customer={payLoanCustomer}
          onClose={() => setPayLoanCustomer(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* Add / Top-up Credit Modal */}
      {creditCustomer && (
        <AddCreditModal
          customer={creditCustomer}
          onClose={() => setCreditCustomer(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* Customer Ledger Statement Modal */}
      {ledgerCustomer && (
        <CustomerLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
        />
      )}
    </>
  );
}
