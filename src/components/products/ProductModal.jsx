import React, { useState, useEffect } from 'react';

export default function ProductModal({ product, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    cost_price: '',
    stock: '',
    min_stock: '5',
    category: '',
    sku: '',
    barcode: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        id: product.id || '',
        name: product.name || '',
        price: product.price ?? '',
        cost_price: product.cost_price ?? '',
        stock: product.stock ?? '',
        min_stock: product.min_stock ?? '5',
        category: product.category || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
      });
    } else {
      setFormData({
        id: '',
        name: '',
        price: '',
        cost_price: '',
        stock: '',
        min_stock: '5',
        category: '',
        sku: '',
        barcode: '',
      });
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: formData.id ? Number(formData.id) : undefined,
      name: formData.name.trim(),
      price: parseFloat(formData.price),
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
      stock: parseInt(formData.stock, 10),
      min_stock: formData.min_stock ? parseInt(formData.min_stock, 10) : 5,
      category: formData.category.trim() || null,
      sku: formData.sku.trim() || null,
      barcode: formData.barcode.trim() || null,
    });
  };

  return (
    <div
      className="modal-overlay active"
      id="productModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
    >
      <div className="modal">
        <div className="modal-header">
          <h3 id="modalTitle">{product ? 'Edit Product' : 'Add Product'}</h3>
          <button
            type="button"
            className="modal-close"
            id="closeModal"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <form id="productForm" onSubmit={handleSubmit}>
          <input type="hidden" id="productId" value={formData.id} />

          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="productName">Product Name *</label>
              <input
                type="text"
                id="productName"
                required
                placeholder="Product name"
                autoComplete="off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="productPrice">Selling Price *</label>
                <input
                  type="number"
                  id="productPrice"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="productStock">Stock Quantity *</label>
                <input
                  type="number"
                  id="productStock"
                  min="0"
                  required
                  placeholder="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="productCostPrice">Cost Price (COGS)</label>
                <input
                  type="number"
                  id="productCostPrice"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                />
                <span className="form-help">Used for gross profit calculation</span>
              </div>

              <div className="form-group">
                <label htmlFor="productMinStock">Min Stock Alert</label>
                <input
                  type="number"
                  id="productMinStock"
                  min="0"
                  placeholder="5"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                />
                <span className="form-help">Triggers low stock alert</span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="productCategory">Category</label>
                <input
                  type="text"
                  id="productCategory"
                  placeholder="e.g. Beverages, Food, Hardware"
                  autoComplete="off"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
                <span className="form-help">Leave empty for none</span>
              </div>

              <div className="form-group">
                <label htmlFor="productSku">SKU Code</label>
                <input
                  type="text"
                  id="productSku"
                  placeholder="e.g. BEV-001"
                  autoComplete="off"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
                <span className="form-help">Stock keeping unit</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="productBarcode">Barcode</label>
              <input
                type="text"
                id="productBarcode"
                placeholder="Unique barcode for optical scanner"
                autoComplete="off"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
              <span className="form-help">For USB barcode scanners</span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              id="cancelModal"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
