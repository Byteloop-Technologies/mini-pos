import React from 'react';
import { useSettings } from '../../context/SettingsContext';

export default function DashboardTab({ stats, lowStockProducts, onQuickRestock }) {
  const { formatCurrency } = useSettings();

  const totalProducts = stats?.totalProducts ?? 0;
  const lowStockCount = stats?.lowStockCount ?? 0;
  const todayTotal = stats?.todayTotal ?? 0;
  const todayOrders = stats?.todaySalesCount ?? 0;
  const grossProfit = stats?.todayGrossProfit ?? 0;
  const inventoryRetail = stats?.totalInventoryRetail ?? 0;

  return (
    <>
      <div className="dashboard-grid">
        <div className="stat-card primary">
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            SKU
          </div>
          <div className="stat-info">
            <span className="stat-value" id="statProducts">
              {totalProducts}
            </span>
            <span className="stat-label">Total Products</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            LOW
          </div>
          <div className="stat-info">
            <span className="stat-value" id="statLowStock">
              {lowStockCount}
            </span>
            <span className="stat-label">Low Stock Items</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            REV
          </div>
          <div className="stat-info">
            <span className="stat-value" id="statTodaySales">
              {formatCurrency(todayTotal)}
            </span>
            <span className="stat-label">Today's Revenue</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            ORD
          </div>
          <div className="stat-info">
            <span className="stat-value" id="statTodayOrders">
              {todayOrders}
            </span>
            <span className="stat-label">Today's Orders</span>
          </div>
        </div>

        {/* ERP Extended KPI Cards */}
        <div className="stat-card success" style={{ gridColumn: 'span 2' }}>
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            PRF
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(grossProfit)}</span>
            <span className="stat-label">Today's Gross Profit (Revenue - COGS)</span>
          </div>
        </div>

        <div className="stat-card primary" style={{ gridColumn: 'span 2' }}>
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            VAL
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(inventoryRetail)}</span>
            <span className="stat-label">Total Inventory Retail Value</span>
          </div>
        </div>

        {/* Customer Loans / Market Debt KPI */}
        <div className="stat-card warning" style={{ gridColumn: 'span 2' }}>
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            LOAN
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(stats?.totalOutstandingLoans ?? 0)}</span>
            <span className="stat-label">
              Total Loans Given to Customers ({stats?.debtorsCount ?? 0} active {stats?.debtorsCount === 1 ? 'debtor' : 'debtors'})
            </span>
          </div>
        </div>

        {/* Promotional Discounts Granted KPI */}
        <div className="stat-card info" style={{ gridColumn: 'span 2' }}>
          <div className="stat-icon" aria-hidden="true" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
            DISC
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(stats?.todayDiscounts ?? 0)}</span>
            <span className="stat-label">Today's Discounts & Promotional Savings</span>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-header">
          <h3>Low Stock Alert</h3>
        </div>
        <div className="table-container">
          <div className="table-wrapper">
            <table id="lowStockTable">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody id="lowStockTableBody">
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      All items are sufficiently stocked
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.map((p) => {
                    const isOut = p.stock <= 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          {p.sku && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({p.sku})
                            </span>
                          )}
                        </td>
                        <td>{p.category || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`stock-badge ${isOut ? 'out' : 'warning'}`}>
                            {p.stock} units
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onQuickRestock(p)}
                          >
                            + Restock (+20)
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
