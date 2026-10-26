import React, { useState, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import ProductModal from './ProductModal';
import { api } from '../../api';

export default function ProductsTab({ products, onRefresh }) {
  const { formatCurrency } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = filterCategory === 'All' || p.category === filterCategory;
      const matchText =
        !filterText ||
        p.name.toLowerCase().includes(filterText.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(filterText.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(filterText.toLowerCase()));
      return matchCat && matchText;
    });
  }, [products, filterText, filterCategory]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await api.products.delete(id);
        onRefresh();
      } catch (err) {
        alert(`Failed to delete product: ${err.message}`);
      }
    }
  };

  const handleSave = async (data) => {
    try {
      if (data.id) {
        await api.products.update(data);
      } else {
        await api.products.create(data);
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      alert(`Failed to save product: ${err.message}`);
    }
  };

  return (
    <>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2>Product Management</h2>
          <span className="stat-item">{products.length} registered</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Filter products / SKU..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" id="addProductBtn" onClick={handleOpenAdd}>
            Add Product
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table id="productsTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th>Barcode</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody id="productsTableBody">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    No products found
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stock > 0 && p.stock <= (p.min_stock || 5);
                  const isOut = p.stock <= 0;
                  const badgeClass = isOut ? 'out' : isLow ? 'low' : 'ok';
                  const badgeText = isOut ? '0 OUT' : isLow ? `${p.stock} LOW` : `${p.stock} OK`;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'var(--font-data)' }}>#{p.id}</td>
                      <td>
                        <strong>{p.name}</strong>
                        {p.sku && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            SKU: {p.sku}
                          </div>
                        )}
                      </td>
                      <td>{p.category || '—'}</td>
                      <td>{formatCurrency(p.price)}</td>
                      <td>
                        <span className={`stock-badge ${badgeClass}`}>{badgeText}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem' }}>
                        {p.barcode || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => handleOpenEdit(p)}
                            aria-label={`Edit ${p.name}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn delete"
                            onClick={() => handleDelete(p.id)}
                            aria-label={`Delete ${p.name}`}
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

      <ProductModal
        isOpen={modalOpen}
        product={editingProduct}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
