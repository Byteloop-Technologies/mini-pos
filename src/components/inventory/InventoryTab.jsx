import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';

export default function InventoryTab({ products, onRefresh }) {
  const { formatCurrency } = useSettings();
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [adjustModalProduct, setAdjustModalProduct] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustType, setAdjustType] = useState('in');
  const [adjustReference, setAdjustReference] = useState('PO-RESTOCK');
  const [adjustNotes, setAdjustNotes] = useState('');

  const loadMovements = useCallback(async () => {
    setLoadingMovements(true);
    try {
      const data = await api.products.getMovements();
      setMovements(data || []);
    } catch (err) {
      console.error('Failed to load movements:', err);
    } finally {
      setLoadingMovements(false);
    }
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Inventory valuation calculations
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const costValuation = products.reduce((sum, p) => sum + p.stock * (p.cost_price || 0), 0);
  const retailValuation = products.reduce((sum, p) => sum + p.stock * p.price, 0);
  const potentialProfit = retailValuation - costValuation;
  const marginPct = retailValuation > 0 ? (potentialProfit / retailValuation) * 100 : 0;

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustModalProduct) return;
    const qty = parseInt(adjustQuantity, 10);
    if (!Number.isInteger(qty) || qty === 0) {
      alert('Please enter a valid non-zero adjustment quantity');
      return;
    }
    const finalQty = adjustType === 'out' || adjustType === 'damage' ? -Math.abs(qty) : Math.abs(qty);

    try {
      await api.products.adjustStock({
        productId: adjustModalProduct.id,
        quantity: finalQty,
        type: adjustType,
        reference: adjustReference,
        notes: adjustNotes,
      });
      setAdjustModalProduct(null);
      setAdjustQuantity('');
      setAdjustNotes('');
      onRefresh();
      loadMovements();
    } catch (err) {
      alert(`Stock adjustment failed: ${err.message}`);
    }
  };

  return (
    <>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2>Warehouse & Inventory Management</h2>
          <span className="stat-item">{products.length} SKUs</span>
          <span className="stat-item">{totalUnits} Total Units</span>
        </div>
      </div>

      {/* Valuation Metrics */}
      <div className="dashboard-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card primary">
          <div className="stat-icon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>COST</div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(costValuation)}</span>
            <span className="stat-label">Inventory at Cost</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>RETL</div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(retailValuation)}</span>
            <span className="stat-label">Inventory at Retail</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>MRG</div>
          <div className="stat-info">
            <span className="stat-value">{marginPct.toFixed(1)}%</span>
            <span className="stat-label">Projected Margin</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>UNITS</div>
          <div className="stat-info">
            <span className="stat-value">{totalUnits}</span>
            <span className="stat-label">Total Units on Hand</span>
          </div>
        </div>
      </div>

      {/* Two columns: Product Stock List & Stock Movement Audit Log */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Products Stock Table */}
        <div className="section" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="section-header">
            <h3 className="section-title">Stock Levels & Fast Adjust</h3>
          </div>
          <div className="table-wrapper" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Product / SKU</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Retail</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLow = p.stock <= (p.min_stock || 5);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        {p.sku && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            SKU: {p.sku}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(p.cost_price || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(p.price)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`stock-badge ${isLow ? 'warning' : 'ok'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setAdjustModalProduct(p);
                            setAdjustType('in');
                            setAdjustReference(`PO-${Math.floor(1000 + Math.random() * 9000)}`);
                          }}
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Movement Audit Log */}
        <div className="section" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="section-header">
            <h3 className="section-title">Stock Movement Audit Log</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={loadMovements}
            >
              Refresh
            </button>
          </div>
          <div className="table-wrapper" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th>Reference</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                      No stock movements recorded
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.product_name}</strong>
                        </td>
                        <td>
                          <span className={`stock-badge ${m.type === 'sale' ? 'ok' : m.type === 'in' ? 'info' : 'warning'}`}>
                            {m.type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td style={{ fontSize: '0.75rem' }}>{m.reference || '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {/* Stock Adjustment Modal */}
      {adjustModalProduct && (
        <div className="modal-overlay active" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Stock Adjustment: {adjustModalProduct.name}</h3>
              <button className="modal-close" onClick={() => setAdjustModalProduct(null)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit}>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Current stock: <strong>{adjustModalProduct.stock} units</strong>.
                </p>

                <div className="form-group">
                  <label>Adjustment Type</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
                  >
                    <option value="in">Stock-in / Supplier Inward Delivery (+)</option>
                    <option value="out">Stock-out / Transfer (-)</option>
                    <option value="damage">Damaged / Expired Write-off (-)</option>
                    <option value="adjustment">Stock Audit Count Correction (+/-)</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 10"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Reference Code</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-1029, Audit #4"
                      value={adjustReference}
                      onChange={(e) => setAdjustReference(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes / Reason</label>
                  <input
                    type="text"
                    placeholder="Optional details for audit log"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAdjustModalProduct(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
