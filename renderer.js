// Renderer process for Mini POS System

// State
let products = [];
let cart = [];
let currentCategory = 'all';
let sales = [];

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const productSearch = document.getElementById('productSearch');
const searchResults = document.getElementById('searchResults');
const categoriesEl = document.getElementById('categories');
const productGrid = document.getElementById('productGrid');
const productCountEl = document.getElementById('productCount');
const cartItems = document.getElementById('cartItems');
const cartCountEl = document.getElementById('cartCount');
const subtotalEl = document.getElementById('subtotal');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('total');
const clearCartBtn = document.getElementById('clearCart');
const checkoutBtn = document.getElementById('checkoutBtn');
const cashReceived = document.getElementById('cashReceived');
const cashInput = document.getElementById('cashInput');
const changeDisplay = document.getElementById('changeDisplay');
const paymentRadios = document.querySelectorAll('input[name="payment"]');
const productsTableBody = document.getElementById('productsTableBody');
const salesTableBody = document.getElementById('salesTableBody');
const lowStockTableBody = document.getElementById('lowStockTableBody');
const addProductBtn = document.getElementById('addProductBtn');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const closeModal = document.getElementById('closeModal');
const cancelModal = document.getElementById('cancelModal');
const modalTitle = document.getElementById('modalTitle');
const productIdInput = document.getElementById('productId');
const saleDetailModal = document.getElementById('saleDetailModal');
const saleDetailContent = document.getElementById('saleDetailContent');
const closeSaleModal = document.getElementById('closeSaleModal');
const statsBar = document.getElementById('statsBar');

// Stat elements
const statProducts = document.getElementById('statProducts');
const statLowStock = document.getElementById('statLowStock');
const statTodaySales = document.getElementById('statTodaySales');
const statTodayOrders = document.getElementById('statTodayOrders');

// Category icons
const categoryIcons = {
  'Beverages': '☕',
  'Food': '🍔',
  'Snacks': '🍿',
  'Desserts': '🍰',
  'Drinks': '🥤',
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  await loadSales();
  await loadDashboardStats();
  setupEventListeners();
  renderCategories();
  renderProductGrid();
  renderCart();
  renderProductsTable();
  renderSalesTable();
  renderLowStockTable();
});

// Event Listeners
function setupEventListeners() {
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Product search
  productSearch.addEventListener('input', debounce(handleSearch, 150));
  productSearch.addEventListener('focus', () => {
    if (productSearch.value.trim()) handleSearch();
  });
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== productSearch && !e.target.closest('.search-icon')) {
      searchResults.classList.remove('active');
    }
  });

  // Cart
  clearCartBtn.addEventListener('click', clearCart);
  checkoutBtn.addEventListener('click', checkout);

  // Initialize the selected payment method.
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  cashInput.hidden = selectedPayment?.value !== 'cash';

  // Cash input
  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      cashInput.hidden = radio.value !== 'cash';
      updateChange();
    });
  });
  cashReceived.addEventListener('input', updateChange);

  // Product modal
  addProductBtn.addEventListener('click', () => openProductModal());
  closeModal.addEventListener('click', closeProductModal);
  cancelModal.addEventListener('click', closeProductModal);
  productForm.addEventListener('submit', handleProductSubmit);
  productModal.addEventListener('click', (e) => {
    if (e.target === productModal) closeProductModal();
  });

  // Sale detail modal
  closeSaleModal.addEventListener('click', () => saleDetailModal.classList.remove('active'));
  saleDetailModal.addEventListener('click', (e) => {
    if (e.target === saleDetailModal) saleDetailModal.classList.remove('active');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductModal();
      saleDetailModal.classList.remove('active');
      searchResults.classList.remove('active');
    }
    if (e.key === 'Enter' && document.activeElement === productSearch) {
      const firstResult = searchResults.querySelector('.search-result-item');
      if (firstResult) firstResult.click();
    }
  });
}

// Tab switching
function switchTab(tabName) {
  tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
    t.setAttribute('aria-selected', t.dataset.tab === tabName);
  });
  tabPanels.forEach(p => p.classList.toggle('active', p.id === `${tabName}-panel`));

  // Refresh data when switching to certain tabs
  if (tabName === 'sales') loadSales();
  if (tabName === 'dashboard') loadDashboardStats();
  if (tabName === 'products') renderProductsTable();
}

// Load data from main process
async function loadProducts() {
  products = await window.api.products.getAll();
}

async function loadSales() {
  sales = await window.api.sales.getAll();
  renderSalesTable();
}

async function loadDashboardStats() {
  const stats = await window.api.sales.getStats();
  statProducts.textContent = stats.totalProducts;
  statLowStock.textContent = stats.lowStockCount;
  statTodaySales.textContent = formatCurrency(stats.todayTotal);
  statTodayOrders.textContent = stats.todaySalesCount;

  // Update stats bar
  renderStatsBar(stats);
}

function renderStatsBar(stats) {
  statsBar.innerHTML = `
    <div class="stat-item">Products: <strong>${stats.totalProducts}</strong></div>
    <div class="stat-item ${stats.lowStockCount > 0 ? 'warning' : 'success'}">Low Stock: <strong>${stats.lowStockCount}</strong></div>
    <div class="stat-item success">Today: <strong>${formatCurrency(stats.todayTotal)}</strong></div>
    <div class="stat-item info">Orders: <strong>${stats.todaySalesCount}</strong></div>
  `;
}

// Categories
function renderCategories() {
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  categoriesEl.innerHTML = categories.map(cat => {
    const count = cat === 'all' ? products.length : products.filter(p => p.category === cat).length;
    const icon = categoryIcons[cat] || '📦';
    return `
      <button class="category-btn ${cat === currentCategory ? 'active' : ''}" data-category="${cat}" role="tab" aria-selected="${cat === currentCategory}">
        <span>${icon}</span>
        <span>${cat === 'all' ? 'All' : cat}</span>
        <span class="category-count">${count}</span>
      </button>
    `;
  }).join('');

  categoriesEl.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.category;
      renderCategories();
      renderProductGrid();
    });
  });
}

// Product Grid
function renderProductGrid() {
  let filtered = products;
  if (currentCategory !== 'all') {
    filtered = products.filter(p => p.category === currentCategory);
  }

  // Update product count
  if (productCountEl) {
    productCountEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
  }

  productGrid.innerHTML = filtered.map(product => {
    const icon = categoryIcons[product.category] || '📦';
    const stockClass = product.stock <= 5 && product.stock > 0 ? 'low-stock' : product.stock === 0 ? 'out-of-stock' : '';
    const stockBadgeClass = product.stock <= 5 && product.stock > 0 ? 'low' : product.stock === 0 ? 'out' : 'ok';
    const stockText = product.stock === 0 ? 'Out of Stock' : product.stock <= 5 ? `Low: ${product.stock}` : `In Stock: ${product.stock}`;

    return `
      <div class="product-card ${stockClass}" data-id="${product.id}" role="button" tabindex="0" aria-label="${escapeHtml(product.name)}, ${formatCurrency(product.price)}, ${stockText}">
        <div class="product-image" aria-hidden="true">${icon}</div>
        <div class="product-name">${escapeHtml(product.name)}</div>
        <div class="product-price">${formatCurrency(product.price)}</div>
        <div class="product-stock ${stockBadgeClass}">
          <span class="stock-badge-dot" aria-hidden="true"></span>
          <span>${stockText}</span>
        </div>
      </div>
    `;
  }).join('');

  productGrid.querySelectorAll('.product-card:not(.out-of-stock)').forEach(card => {
    card.addEventListener('click', () => addToCart(parseInt(card.dataset.id)));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        addToCart(parseInt(card.dataset.id));
      }
    });
  });
}

// Search
async function handleSearch() {
  const query = productSearch.value.trim();
  if (!query) {
    searchResults.classList.remove('active');
    return;
  }

  const results = await window.api.products.search(query);
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-result-item" style="color: var(--text-muted); padding: var(--space-3) var(--space-4);">No products found</div>';
  } else {
    searchResults.innerHTML = results.map(p => {
      const icon = categoryIcons[p.category] || '📦';
      const stockClass = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : '';
      return `
        <div class="search-result-item" data-id="${p.id}" role="option">
          <span style="font-size: 1.25rem;" aria-hidden="true">${icon}</span>
          <div class="search-result-info">
            <div class="search-result-name">${escapeHtml(p.name)}</div>
            <div class="search-result-meta">
              <span class="search-result-price">${formatCurrency(p.price)}</span>
              <span class="search-result-stock ${stockClass}">Stock: ${p.stock}</span>
              <span>${p.category || 'Uncategorized'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    searchResults.querySelectorAll('.search-result-item[data-id]').forEach(item => {
      item.addEventListener('click', () => {
        addToCart(parseInt(item.dataset.id));
        productSearch.value = '';
        searchResults.classList.remove('active');
      });
    });
  }
  searchResults.classList.add('active');
}

// Cart
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (product.stock <= 0) {
    alert('Out of stock!');
    return;
  }

  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    if (existing.quantity >= product.stock) {
      alert('Not enough stock!');
      return;
    }
    existing.quantity++;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      maxStock: product.stock
    });
  }
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.productId !== productId);
  renderCart();
}

function updateQuantity(productId, delta) {
  const item = cart.find(i => i.productId === productId);
  if (!item) return;

  const product = products.find(p => p.id === productId);
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    removeFromCart(productId);
    return;
  }

  if (product && newQty > product.stock) {
    alert(`Only ${product.stock} in stock!`);
    return;
  }

  item.quantity = newQty;
  renderCart();
}

function clearCart() {
  if (cart.length === 0) return;
  if (confirm('Clear the cart?')) {
    cart = [];
    renderCart();
  }
}

function renderCart() {
  // Update cart count
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCountEl) {
    cartCountEl.textContent = totalItems;
  }

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="cart-empty" role="status">
        <div class="cart-empty-icon" aria-hidden="true">🛒</div>
        <div class="cart-empty-text">Cart is empty</div>
        <div class="cart-empty-hint">Click products to add them</div>
      </div>
    `;
    updateTotals();
    return;
  }

  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item" role="listitem">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${formatCurrency(item.price)} each</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" data-action="decrease" data-id="${item.productId}" aria-label="Decrease quantity">−</button>
        <span class="qty-value" aria-live="polite">${item.quantity}</span>
        <button class="qty-btn" data-action="increase" data-id="${item.productId}" aria-label="Increase quantity">+</button>
      </div>
      <div class="cart-item-total" aria-label="Line total">${formatCurrency(item.price * item.quantity)}</div>
      <button class="remove-btn" data-id="${item.productId}" aria-label="Remove ${escapeHtml(item.name)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
  `).join('');

  cartItems.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      updateQuantity(id, action === 'increase' ? 1 : -1);
    });
  });

  cartItems.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.id)));
  });

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  subtotalEl.textContent = formatCurrency(subtotal);
  taxEl.textContent = formatCurrency(tax);
  totalEl.textContent = formatCurrency(total);

  updateChange();
}

function updateChange() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal * 1.08;
  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

  if (paymentMethod === 'cash' && cashReceived.value) {
    const received = parseFloat(cashReceived.value);
    const change = received - total;
    changeDisplay.textContent = `Change: ${formatCurrency(change)}`;
    changeDisplay.className = 'change-display ' + (change >= 0 ? 'positive' : 'negative');
  } else {
    changeDisplay.textContent = 'Change: $0.00';
    changeDisplay.className = 'change-display';
  }
}

async function checkout() {
  if (cart.length === 0) {
    alert('Cart is empty!');
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.round(subtotal * 1.08 * 100) / 100;
  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

  if (paymentMethod === 'cash') {
    const received = parseFloat(cashReceived.value) || 0;
    if (received < total) {
      alert('Insufficient cash received!');
      return;
    }
  }

  const sale = {
    paymentMethod,
    items: cart.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    }))
  };

  try {
    const completedSale = await window.api.sales.create(sale);
    alert(`Sale #${completedSale.id} completed successfully!`);
    cart = [];
    renderCart();
    cashReceived.value = '';
    await loadProducts();
    renderProductGrid();
    renderProductsTable();
    await loadDashboardStats();
    renderLowStockTable();
  } catch (error) {
    console.error(error);
    alert('Error processing sale: ' + error.message);
  }
}

// Products Table
function renderProductsTable() {
  productsTableBody.innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category || '-')}</td>
      <td>${formatCurrency(p.price)}</td>
      <td>
        <span class="stock-badge ${p.stock <= 5 && p.stock > 0 ? 'low' : p.stock === 0 ? 'out' : 'ok'}">
          <span class="stock-badge-dot" aria-hidden="true"></span>
          ${p.stock}
        </span>
      </td>
      <td>${escapeHtml(p.barcode || '-')}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" data-id="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">Edit</button>
          <button class="action-btn delete" data-id="${p.id}" aria-label="Delete ${escapeHtml(p.name)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  productsTableBody.querySelectorAll('.action-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(parseInt(btn.dataset.id)));
  });

  productsTableBody.querySelectorAll('.action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this product?')) {
        await window.api.products.delete(parseInt(btn.dataset.id));
        await loadProducts();
        renderCategories();
        renderProductGrid();
        renderProductsTable();
        await loadDashboardStats();
        renderLowStockTable();
      }
    });
  });
}

// Sales Table
function renderSalesTable() {
  salesTableBody.innerHTML = sales.map(s => `
    <tr>
      <td>#${s.id}</td>
      <td>${formatDateTime(s.created_at)}</td>
      <td>${s.items ? s.items.length : 0} items</td>
      <td>${formatCurrency(s.total)}</td>
      <td><span class="stock-badge ${s.payment_method === 'cash' ? 'ok' : s.payment_method === 'card' ? 'info' : 'warning'}">${s.payment_method}</span></td>
      <td>
        <button class="action-btn view" data-id="${s.id}" aria-label="View sale #${s.id}">View</button>
      </td>
    </tr>
  `).join('');

  salesTableBody.querySelectorAll('.action-btn.view').forEach(btn => {
    btn.addEventListener('click', () => showSaleDetail(parseInt(btn.dataset.id)));
  });
}

// Low Stock Table
function renderLowStockTable() {
  const lowStock = products.filter(p => p.stock <= 5 && p.stock > 0);
  const outOfStock = products.filter(p => p.stock === 0);

  const allLow = [...lowStock, ...outOfStock];

  if (allLow.length === 0) {
    lowStockTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: var(--space-6);">All products well stocked ✓</td></tr>';
    return;
  }

  lowStockTableBody.innerHTML = allLow.map(p => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category || '-')}</td>
      <td>
        <span class="stock-badge ${p.stock === 0 ? 'out' : 'low'}">
          <span class="stock-badge-dot" aria-hidden="true"></span>
          ${p.stock}
        </span>
      </td>
      <td>
        <button class="action-btn restock" data-id="${p.id}" aria-label="Restock ${escapeHtml(p.name)}">Restock</button>
      </td>
    </tr>
  `).join('');

  lowStockTableBody.querySelectorAll('.action-btn.restock').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(parseInt(btn.dataset.id)));
  });
}

// Sale Detail Modal
function showSaleDetail(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return;

  saleDetailContent.innerHTML = `
    <div class="sale-header">
      <h4>Sale #${sale.id}</h4>
      <div class="sale-meta">
        <span>${formatDateTime(sale.created_at)}</span>
        <span>${sale.payment_method.toUpperCase()}</span>
      </div>
    </div>
    <table class="sale-items-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map(item => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.price * item.quantity)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="sale-total">Total: ${formatCurrency(sale.total)}</div>
  `;

  saleDetailModal.classList.add('active');
}

// Product Modal
function openProductModal(id = null) {
  const product = id ? products.find(p => p.id === id) : null;

  productIdInput.value = product?.id || '';
  document.getElementById('productName').value = product?.name || '';
  document.getElementById('productPrice').value = product?.price || '';
  document.getElementById('productStock').value = product?.stock || 0;
  document.getElementById('productCategory').value = product?.category || '';
  document.getElementById('productBarcode').value = product?.barcode || '';

  modalTitle.textContent = product ? 'Edit Product' : 'Add Product';
  productModal.classList.add('active');
  document.getElementById('productName').focus();
}

function closeProductModal() {
  productModal.classList.remove('active');
  productForm.reset();
}

async function handleProductSubmit(e) {
  e.preventDefault();

  const product = {
    name: document.getElementById('productName').value.trim(),
    price: parseFloat(document.getElementById('productPrice').value),
    stock: parseInt(document.getElementById('productStock').value) || 0,
    category: document.getElementById('productCategory').value.trim() || null,
    barcode: document.getElementById('productBarcode').value.trim() || null
  };

  if (!product.name || isNaN(product.price) || product.price < 0) {
    alert('Please fill in all required fields');
    return;
  }

  const id = productIdInput.value ? parseInt(productIdInput.value) : null;

  try {
    if (id) {
      product.id = id;
      await window.api.products.update(product);
    } else {
      await window.api.products.create(product);
    }

    closeProductModal();
    await loadProducts();
    renderCategories();
    renderProductGrid();
    renderProductsTable();
    await loadDashboardStats();
    renderLowStockTable();
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      alert('Barcode already exists!');
    } else {
      alert('Error saving product: ' + error.message);
    }
  }
}

// Utilities
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}