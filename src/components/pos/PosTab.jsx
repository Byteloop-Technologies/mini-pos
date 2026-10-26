import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCart } from '../../context/CartContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api';
import ReceiptModal from './ReceiptModal';
import HeldOrdersModal from './HeldOrdersModal';
import AddCreditModal from '../customers/AddCreditModal';
import PayLoanModal from '../customers/PayLoanModal';
import { printThermalBill } from '../../utils/thermalPrinter';

export default function PosTab({ products, customers, onRefreshProducts, onSaleCompleted }) {
  const { settings, formatCurrency } = useSettings();
  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    loadHeldOrder,
    cartCount,
    subtotal,
    taxRate,
    taxAmount,
    total,
    selectedCustomer,
    setSelectedCustomer,
    notes,
    setNotes,
    heldOrderId,
  } = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);

  // Held orders state
  const [heldOrders, setHeldOrders] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [parkReference, setParkReference] = useState('');
  const [showParkPrompt, setShowParkPrompt] = useState(false);
  const [showQuickCreditModal, setShowQuickCreditModal] = useState(false);
  const [showPayLoanModal, setShowPayLoanModal] = useState(false);

  // Active customer with live balance & loan lookup
  const activeCustomer = useMemo(() => {
    if (!selectedCustomer?.id) return selectedCustomer;
    return customers.find((c) => c.id === selectedCustomer.id) || selectedCustomer;
  }, [customers, selectedCustomer]);

  const activeCustomerDebt = Number(activeCustomer?.outstanding_debt || 0);
  const activeCustomerBalance = Number(activeCustomer?.credit_balance || 0);
  const activeCustomerLimit = Number(activeCustomer?.credit_limit || 0);
  const activeCustomerAvailable = activeCustomerBalance + activeCustomerLimit;

  const searchContainerRef = useRef(null);

  // Load held orders
  const loadHeldOrders = useCallback(async () => {
    try {
      const data = await api.heldOrders.getAll();
      setHeldOrders(data || []);
    } catch (err) {
      console.error('Failed to load held orders:', err);
    }
  }, []);

  useEffect(() => {
    loadHeldOrders();
  }, [loadHeldOrders]);

  // Handle Search Input & Barcode Scanning
  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    try {
      const results = await api.products.search(trimmed);
      setSearchResults(results || []);
      setShowSearchResults(true);
    } catch {
      setSearchResults([]);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchQuery.trim().toLowerCase();
      if (!term) return;

      // Exact barcode or SKU match
      const matched = products.find(
        (p) => (p.barcode && p.barcode.toLowerCase() === term) ||
               (p.sku && p.sku.toLowerCase() === term)
      ) || searchResults[0];

      if (matched && matched.stock > 0) {
        addItem(matched);
        setSearchQuery('');
        setShowSearchResults(false);
      }
    }
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Category counts and filter
  const categories = useMemo(() => {
    const map = new Map();
    map.set('All', products.length);
    for (const p of products) {
      const cat = p.category || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return products;
    return products.filter((p) => (p.category || 'Uncategorized') === selectedCategory);
  }, [products, selectedCategory]);

  // Cash change calculation
  const cashNum = parseFloat(cashReceived);
  const changeValue = Number.isFinite(cashNum) ? cashNum - total : 0;
  const isChangePositive = Number.isFinite(cashNum) && cashNum >= total;
  const hasCashInput = Boolean(cashReceived && !isNaN(cashNum));

  // Quick cash helper
  const handleQuickCash = (amount) => {
    if (amount === 'exact') {
      setCashReceived(total.toFixed(2));
    } else {
      const current = parseFloat(cashReceived) || 0;
      setCashReceived((current + amount).toFixed(2));
    }
  };

  // Checkout Handler
  const handleCheckout = async () => {
    if (items.length === 0) {
      alert('Cart is empty. Please add items before checking out.');
      return;
    }

    if (paymentMethod === 'cash') {
      if (!hasCashInput) {
        alert('Please enter cash amount received.');
        return;
      }
      if (cashNum < total) {
        alert('Cash received is less than total amount!');
        return;
      }
    }

    if (paymentMethod === 'credit') {
      if (!activeCustomer?.id) {
        alert('Please select a registered customer to charge on credit.');
        return;
      }
      if (total > activeCustomerAvailable) {
        alert(`Insufficient customer credit! Available: ${formatCurrency(activeCustomerAvailable)}, Total: ${formatCurrency(total)}`);
        return;
      }
    }

    setCheckoutLoading(true);
    try {
      const salePayload = {
        paymentMethod,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        taxRate,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || null,
        notes: notes || null,
      };

      const result = await api.sales.create(salePayload);

      // If this was a held order, remove it
      if (heldOrderId) {
        await api.heldOrders.delete(heldOrderId);
        loadHeldOrders();
      }

      // Prepare completed sale object
      const saleReceiptData = {
        ...result,
        cashReceived: paymentMethod === 'cash' ? cashNum : null,
        changeDue: paymentMethod === 'cash' ? Math.max(0, changeValue) : null,
      };

      // Open receipt modal
      setCompletedSale(saleReceiptData);

      // Auto thermal print if configured in settings
      if (settings.thermal_auto_print === 'true') {
        printThermalBill(saleReceiptData, settings).catch((err) => {
          console.warn('Auto print failed:', err);
        });
      }

      // Clear cart
      clearCart();
      setCashReceived('');
      onRefreshProducts?.();
      onSaleCompleted?.();
    } catch (err) {
      console.error('Checkout error:', err);
      alert(`Checkout failed: ${err.message || 'Unknown error'}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Print Draft / Proforma Bill before checkout
  const handlePrintDraftBill = () => {
    if (items.length === 0) {
      alert('Cart is empty. Add items to print a bill.');
      return;
    }
    setCompletedSale({
      isDraft: true,
      id: `EST-${Math.floor(1000 + Math.random() * 9000)}`,
      items,
      subtotal,
      tax: taxAmount,
      total,
      customer_name: selectedCustomer?.name || 'Walk-in',
      payment_method: 'PENDING',
      created_at: new Date().toISOString(),
    });
  };

  // Park Order Handler
  const handleParkOrder = async () => {
    if (items.length === 0) return;
    const ref = parkReference.trim() || `Order #${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await api.heldOrders.save({
        reference: ref,
        customerName: selectedCustomer?.name || null,
        items,
        total,
        notes,
      });
      clearCart();
      setShowParkPrompt(false);
      setParkReference('');
      loadHeldOrders();
    } catch (err) {
      alert(`Failed to park order: ${err.message}`);
    }
  };

  const handleRecallOrder = (order) => {
    loadHeldOrder(order);
    setShowHeldModal(false);
  };

  const handleDeleteHeld = async (id) => {
    if (confirm('Discard this parked order?')) {
      await api.heldOrders.delete(id);
      loadHeldOrders();
    }
  };

  return (
    <div className="pos-grid">
      {/* POS Left: Catalog */}
      <div className="pos-left">
        {/* Search Section */}
        <section className="section search-section" ref={searchContainerRef}>
          <div className="section-header">
            <h3 className="section-title">Search Products & Barcodes</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Enter barcode + [Enter] to scan
            </span>
          </div>
          <div className="section-content">
            <div className="search-bar">
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  id="productSearch"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search products or scan barcode..."
                  autoComplete="off"
                  aria-label="Search products"
                />
              </div>

              {/* Search Results Dropdown */}
              <div
                className={`search-results ${showSearchResults ? 'active' : ''}`}
                id="searchResults"
                role="listbox"
              >
                {searchResults.length === 0 ? (
                  <div className="search-result-item" style={{ color: 'var(--text-muted)' }}>
                    No products found
                  </div>
                ) : (
                  searchResults.map((p) => (
                    <div
                      key={p.id}
                      className="search-result-item"
                      role="option"
                      onClick={() => {
                        addItem(p);
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }}
                    >
                      <div className="search-result-info">
                        <div className="search-result-name">{p.name}</div>
                        <div className="search-result-meta">
                          <span className="search-result-price">{formatCurrency(p.price)}</span>
                          <span className={`search-result-stock ${p.stock <= 0 ? 'out' : p.stock <= (p.min_stock || 5) ? 'low' : ''}`}>
                            Stock: {p.stock}
                          </span>
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.barcode && <span>Bar: {p.barcode}</span>}
                          <span>{p.category || 'Uncategorized'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="section category-section">
          <div className="section-header">
            <h3 className="section-title">Categories</h3>
          </div>
          <div className="section-content">
            <div className="categories" id="categories" role="tablist">
              {categories.map(([cat, count]) => (
                <button
                  key={cat}
                  className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                  role="tab"
                  aria-selected={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span>{cat}</span>
                  <span className="category-count">({count})</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Catalog Section */}
        <section className="section catalog-section">
          <div className="section-header">
            <h3 className="section-title">Product Catalog</h3>
            <span className="stat-item" id="productCount">
              {filteredProducts.length} items
            </span>
          </div>
          <div className="section-content">
            <div className="product-grid" id="productGrid" role="grid">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= (p.min_stock || 5);
                const cardClass = [
                  'product-card',
                  isOutOfStock ? 'out-of-stock' : '',
                  isLowStock ? 'low-stock' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={p.id}
                    className={cardClass}
                    data-id={p.id}
                    tabIndex={isOutOfStock ? -1 : 0}
                    onClick={() => {
                      if (!isOutOfStock) addItem(p);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isOutOfStock) {
                        e.preventDefault();
                        addItem(p);
                      }
                    }}
                  >
                    <div className="product-image">
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                        {(p.sku || p.category?.slice(0, 3) || 'SKU').toUpperCase()}
                      </span>
                    </div>
                    <div className="product-name">{p.name}</div>
                    <div className="product-price">{formatCurrency(p.price)}</div>
                    <div
                      className={`product-stock ${
                        isOutOfStock ? 'out' : isLowStock ? 'low' : 'ok'
                      }`}
                    >
                      <span className="stock-badge-dot" />
                      <span>{isOutOfStock ? 'Out of Stock' : `${p.stock} in stock`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* POS Right: Cart Panel */}
      <div className="pos-right">
        <section className="cart-panel" role="region" aria-label="Shopping Cart">
          {/* Cart Header */}
          <div className="cart-header">
            <h2 className="cart-title">
              Cart
              <span className="cart-count" id="cartCount">
                {cartCount}
              </span>
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              {heldOrders.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowHeldModal(true)}
                  title="Recall parked orders"
                >
                  Parked ({heldOrders.length})
                </button>
              )}
              {items.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handlePrintDraftBill}
                    title="Print draft bill / order slip for customer"
                  >
                    Print Bill
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowParkPrompt(true)}
                    title="Park current order"
                  >
                    Park
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                id="clearCart"
                onClick={clearCart}
                aria-label="Clear cart"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Customer selector (ERP Feature) */}
          <div style={{ padding: '8px 16px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Customer:</span>
            <select
              style={{ flex: 1, minWidth: '130px', padding: '4px 8px', fontSize: '0.8125rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
              value={activeCustomer?.id || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                const cust = customers.find((c) => c.id === id) || null;
                setSelectedCustomer(cust);
              }}
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>

            {activeCustomer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activeCustomerDebt > 0 ? (
                  <span
                    className="stock-badge out"
                    style={{ fontSize: '0.6875rem', fontWeight: 700 }}
                    title={`Outstanding loan debt: ${formatCurrency(activeCustomerDebt)}`}
                  >
                    Debt: {formatCurrency(activeCustomerDebt)}
                  </span>
                ) : (
                  <span
                    className="stock-badge ok"
                    style={{ fontSize: '0.6875rem' }}
                    title="No outstanding debt"
                  >
                    No Debt
                  </span>
                )}
                {activeCustomerDebt > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}
                    onClick={() => setShowPayLoanModal(true)}
                    title="Settle customer loan repayment (after payment)"
                  >
                    Settle Loan
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', fontSize: '0.6875rem' }}
                  onClick={() => setShowQuickCreditModal(true)}
                  title="Top-up store credit for this customer"
                >
                  + Credit
                </button>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="cart-items" id="cartItems" role="list">
            {items.length === 0 ? (
              <div className="cart-empty" role="status">
                <div className="cart-empty-text">Cart is empty</div>
                <div className="cart-empty-hint">Click products or scan barcode to add</div>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.productId} className="cart-item" role="listitem">
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">{formatCurrency(item.price)} each</div>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-item-total">
                    {formatCurrency(item.price * item.quantity)}
                  </div>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeItem(item.productId)}
                    aria-label="Remove item"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="cart-divider" />

          {/* Cart Summary */}
          <div className="cart-summary">
            <div className="summary-row">
              <span className="summary-label">Subtotal</span>
              <span className="summary-value" id="subtotal">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">
                {settings.tax_name} ({taxRate}%)
              </span>
              <span className="summary-value" id="tax">
                {formatCurrency(taxAmount)}
              </span>
            </div>
            <div className="summary-row total">
              <span className="summary-label">Total</span>
              <span className="summary-value" id="total">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="payment-section">
            <div className="payment-methods" role="radiogroup" aria-label="Payment method">
              <label className="payment-method">
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                  aria-label="Cash payment"
                />
                <span className="payment-method-icon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  CASH
                </span>
              </label>

              <label className="payment-method">
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  aria-label="Card payment"
                />
                <span className="payment-method-icon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  CARD
                </span>
              </label>

              <label className="payment-method">
                <input
                  type="radio"
                  name="payment"
                  value="mobile"
                  checked={paymentMethod === 'mobile'}
                  onChange={() => setPaymentMethod('mobile')}
                  aria-label="Mobile payment"
                />
                <span className="payment-method-icon" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  MOBILE
                </span>
              </label>

              <label className="payment-method">
                <input
                  type="radio"
                  name="payment"
                  value="credit"
                  checked={paymentMethod === 'credit'}
                  onChange={() => setPaymentMethod('credit')}
                  aria-label="Store loan payment (Pay later)"
                />
                <span className="payment-method-icon" style={{ fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.15, textAlign: 'center' }}>
                  STORE LOAN<br /><span style={{ fontSize: '0.5625rem', fontWeight: 400 }}>(PAY LATER)</span>
                </span>
              </label>
            </div>

            {/* Store Loan (Give items on loan / pay later) Info Panel */}
            {paymentMethod === 'credit' && (
              <div style={{ padding: '10px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
                {!activeCustomer ? (
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                    Please select a registered customer above to issue items on store loan.
                  </span>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Customer: <strong>{activeCustomer.name}</strong></span>
                      <span className={`stock-badge ${activeCustomerDebt > 0 ? 'out' : 'ok'}`}>
                        {activeCustomerDebt > 0 ? `Current Debt: ${formatCurrency(activeCustomerDebt)}` : 'No Prior Debt'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center', marginBottom: '6px', fontSize: '0.75rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Current Debt</div>
                        <strong>{formatCurrency(activeCustomerDebt)}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>This Invoice</div>
                        <strong style={{ color: 'var(--accent)' }}>+{formatCurrency(total)}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Total Debt After</div>
                        <strong style={{ color: 'var(--danger)' }}>{formatCurrency(activeCustomerDebt + total)}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Loan Limit: {activeCustomerLimit > 0 ? formatCurrency(activeCustomerLimit) : 'No Limit'}</span>
                      <span>Items given on loan; customer pays debt later.</span>
                    </div>

                    {total > activeCustomerAvailable && (
                      <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, marginTop: '6px' }}>
                        Total exceeds customer loan facility limit by {formatCurrency(total - activeCustomerAvailable)}!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cash Input & Quick Tender Buttons */}
            <div className="cash-input" id="cashInput" hidden={paymentMethod !== 'cash'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="cashReceived" style={{ margin: 0 }}>Amount Received</label>
                {/* Quick tender chips */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.6875rem' }}
                    onClick={() => handleQuickCash('exact')}
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.6875rem' }}
                    onClick={() => handleQuickCash(10)}
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.6875rem' }}
                    onClick={() => handleQuickCash(20)}
                  >
                    +20
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.6875rem' }}
                    onClick={() => handleQuickCash(50)}
                  >
                    +50
                  </button>
                </div>
              </div>
              <input
                type="number"
                id="cashReceived"
                step="0.01"
                min="0"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
                aria-label="Cash received"
              />
              <div
                className={`change-display ${
                  hasCashInput ? (isChangePositive ? 'positive' : 'negative') : ''
                }`}
                id="changeDisplay"
                aria-live="polite"
              >
                Change: {hasCashInput ? formatCurrency(Math.max(0, changeValue)) : formatCurrency(0)}
              </div>
            </div>

            <button
              className="checkout-btn"
              id="checkoutBtn"
              disabled={
                checkoutLoading ||
                items.length === 0 ||
                (paymentMethod === 'credit' && (!activeCustomer?.id || total > activeCustomerAvailable))
              }
              onClick={handleCheckout}
              aria-label="Process checkout"
            >
              {checkoutLoading
                ? 'Processing...'
                : paymentMethod === 'credit'
                ? `Issue Items on Store Loan (${formatCurrency(total)})`
                : 'Checkout'}
            </button>
          </div>
        </section>
      </div>

      {/* Settle Loan Modal for POS Customer */}
      {showPayLoanModal && activeCustomer && (
        <PayLoanModal
          customer={activeCustomer}
          onClose={() => setShowPayLoanModal(false)}
          onSuccess={() => {
            onSaleCompleted?.();
          }}
        />
      )}

      {/* Quick Add Credit Modal for POS Customer */}
      {showQuickCreditModal && activeCustomer && (
        <AddCreditModal
          customer={activeCustomer}
          onClose={() => setShowQuickCreditModal(false)}
          onSuccess={() => {
            onSaleCompleted?.();
          }}
        />
      )}

      {/* Completed Sale / Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* Park Order Prompt Modal */}
      {showParkPrompt && (
        <div className="modal-overlay active" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Park Current Order</h3>
              <button className="modal-close" onClick={() => setShowParkPrompt(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Order Reference / Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Table 5 / Order for John"
                  value={parkReference}
                  onChange={(e) => setParkReference(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowParkPrompt(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleParkOrder}
              >
                Park Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Orders List Modal */}
      {showHeldModal && (
        <HeldOrdersModal
          heldOrders={heldOrders}
          onRecall={handleRecallOrder}
          onDelete={handleDeleteHeld}
          onClose={() => setShowHeldModal(false)}
        />
      )}
    </div>
  );
}
