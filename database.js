const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_PRODUCTS = [
  { name: 'Coffee', price: 2.5, cost_price: 0.8, category: 'Beverages', stock: 100, min_stock: 15, barcode: '1001', sku: 'BEV-001' },
  { name: 'Tea', price: 2.0, cost_price: 0.5, category: 'Beverages', stock: 80, min_stock: 10, barcode: '1002', sku: 'BEV-002' },
  { name: 'Sandwich', price: 5.5, cost_price: 2.2, category: 'Food', stock: 30, min_stock: 8, barcode: '1003', sku: 'FOD-001' },
  { name: 'Cake Slice', price: 3.5, cost_price: 1.4, category: 'Food', stock: 25, min_stock: 5, barcode: '1004', sku: 'FOD-002' },
  { name: 'Water Bottle', price: 1.5, cost_price: 0.4, category: 'Beverages', stock: 150, min_stock: 20, barcode: '1005', sku: 'BEV-003' },
  { name: 'Chips', price: 1.8, cost_price: 0.7, category: 'Snacks', stock: 60, min_stock: 12, barcode: '1006', sku: 'SNK-001' },
  { name: 'Chocolate Bar', price: 2.2, cost_price: 0.9, category: 'Snacks', stock: 50, min_stock: 10, barcode: '1007', sku: 'SNK-002' },
  { name: 'Muffin', price: 2.8, cost_price: 1.1, category: 'Food', stock: 40, min_stock: 8, barcode: '1008', sku: 'FOD-003' },
];

const DEFAULT_SETTINGS = {
  currency_code: 'USD',
  currency_symbol: '$',
  currency_position: 'prefix',
  currency_decimals: '2',
  tax_rate: '8',
  tax_name: 'Sales Tax',
  tax_mode: 'exclusive',
  store_name: 'MINI POS ERP',
  store_phone: '+1 (555) 012-3456',
  store_address: '100 Enterprise Way, Suite 400',
  store_tax_id: 'US-TAX-84920',
  receipt_header: 'TAX INVOICE / RECEIPT',
  receipt_footer: 'Thank you for your business. Please retain receipt for returns.',
  low_stock_threshold: '5',
  max_discount_percent: '50',
  discount_presets: JSON.stringify([
    { name: 'Member Discount', type: 'percentage', value: 5, code: 'MEMBER5' },
    { name: 'Seasonal Sale', type: 'percentage', value: 10, code: 'SAVE10' },
    { name: 'Staff Discount', type: 'percentage', value: 15, code: 'STAFF15' },
    { name: 'Clearance', type: 'percentage', value: 20, code: 'CLEAR20' },
    { name: 'VIP Customer', type: 'percentage', value: 25, code: 'VIP25' },
    { name: 'Voucher $5 Off', type: 'fixed', value: 5, code: 'VOUCHER5' },
  ]),
  thermal_printer_name: '',
  thermal_paper_width: '80mm',
  thermal_silent_print: 'false',
  thermal_auto_print: 'false',
  thermal_feed_lines: '3',
};

class PosDatabase {
  constructor(filePath, legacyDataPath = null) {
    this.db = new DatabaseSync(filePath);
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
      this.createSchema();
      const migrated = this.runTransaction(() => this.initializeData(legacyDataPath));
      if (migrated && !fs.existsSync(`${legacyDataPath}.migrated`)) {
        try {
          fs.renameSync(legacyDataPath, `${legacyDataPath}.migrated`);
        } catch (error) {
          console.warn('Legacy data imported, but could not archive the JSON file:', error.message);
        }
      }
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL CHECK (price >= 0),
        cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
        category TEXT,
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
        sku TEXT,
        barcode TEXT UNIQUE,
        supplier_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total REAL NOT NULL CHECK (total >= 0),
        payment_method TEXT NOT NULL,
        customer_id INTEGER,
        customer_name TEXT,
        subtotal REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        discount_type TEXT DEFAULT 'fixed',
        discount_rate REAL DEFAULT 0,
        discount_reason TEXT,
        notes TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price REAL NOT NULL CHECK (price >= 0),
        discount REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        credit_balance REAL NOT NULL DEFAULT 0,
        credit_limit REAL NOT NULL DEFAULT 0,
        outstanding_debt REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customer_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        balance_after REAL NOT NULL,
        reference TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reference TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS held_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT NOT NULL,
        customer_name TEXT,
        items_json TEXT NOT NULL,
        total REAL NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.migrateSchema();

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_cust_tx_customer_id ON customer_transactions(customer_id);
    `);
  }

  migrateSchema() {
    // Safely add missing columns to existing customers table
    const customerCols = this.db.prepare("PRAGMA table_info(customers)").all().map(c => c.name);
    if (!customerCols.includes('credit_balance')) {
      this.db.exec("ALTER TABLE customers ADD COLUMN credit_balance REAL NOT NULL DEFAULT 0");
    }
    if (!customerCols.includes('credit_limit')) {
      this.db.exec("ALTER TABLE customers ADD COLUMN credit_limit REAL NOT NULL DEFAULT 0");
    }
    if (!customerCols.includes('outstanding_debt')) {
      this.db.exec("ALTER TABLE customers ADD COLUMN outstanding_debt REAL NOT NULL DEFAULT 0");
    }

    // Safely add missing columns to existing products table
    const productCols = this.db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
    if (!productCols.includes('cost_price')) {
      this.db.exec("ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0)");
    }
    if (!productCols.includes('min_stock')) {
      this.db.exec("ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0)");
    }
    if (!productCols.includes('sku')) {
      this.db.exec("ALTER TABLE products ADD COLUMN sku TEXT");
    }
    if (!productCols.includes('supplier_id')) {
      this.db.exec("ALTER TABLE products ADD COLUMN supplier_id INTEGER");
    }

    // Safely add missing columns to existing sales table
    const salesCols = this.db.prepare("PRAGMA table_info(sales)").all().map(c => c.name);
    if (!salesCols.includes('customer_id')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN customer_id INTEGER");
    }
    if (!salesCols.includes('customer_name')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN customer_name TEXT");
    }
    if (!salesCols.includes('subtotal')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0");
    }
    if (!salesCols.includes('tax')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0");
    }
    if (!salesCols.includes('discount')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0");
    }
    if (!salesCols.includes('discount_type')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN discount_type TEXT DEFAULT 'fixed'");
    }
    if (!salesCols.includes('discount_rate')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN discount_rate REAL DEFAULT 0");
    }
    if (!salesCols.includes('discount_reason')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN discount_reason TEXT");
    }
    if (!salesCols.includes('status')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed'");
    }
    if (!salesCols.includes('notes')) {
      this.db.exec("ALTER TABLE sales ADD COLUMN notes TEXT");
    }

    // Safely add missing columns to existing sale_items table
    const saleItemCols = this.db.prepare("PRAGMA table_info(sale_items)").all().map(c => c.name);
    if (!saleItemCols.includes('discount')) {
      this.db.exec("ALTER TABLE sale_items ADD COLUMN discount REAL DEFAULT 0");
    }

    // Safely add missing discount columns to held_orders table
    const heldCols = this.db.prepare("PRAGMA table_info(held_orders)").all().map(c => c.name);
    if (!heldCols.includes('discount')) {
      this.db.exec("ALTER TABLE held_orders ADD COLUMN discount REAL DEFAULT 0");
    }
    if (!heldCols.includes('discount_type')) {
      this.db.exec("ALTER TABLE held_orders ADD COLUMN discount_type TEXT DEFAULT 'fixed'");
    }
    if (!heldCols.includes('discount_rate')) {
      this.db.exec("ALTER TABLE held_orders ADD COLUMN discount_rate REAL DEFAULT 0");
    }
    if (!heldCols.includes('discount_reason')) {
      this.db.exec("ALTER TABLE held_orders ADD COLUMN discount_reason TEXT");
    }
  }

  initializeData(legacyDataPath) {
    if (this.db.prepare("SELECT value FROM app_metadata WHERE key = 'initialized'").get()) return false;

    const { count } = this.db.prepare(`
      SELECT (SELECT COUNT(*) FROM products) + (SELECT COUNT(*) FROM sales)
        + (SELECT COUNT(*) FROM sqlite_sequence) AS count
    `).get();
    let migrated = false;
    if (count === 0) {
      migrated = this.importLegacyData(legacyDataPath);
      if (!migrated) this.seedProducts();
    }
    this.seedDefaults();
    this.db.prepare("INSERT INTO app_metadata (key, value) VALUES ('initialized', '1')").run();
    return migrated;
  }

  importLegacyData(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return false;

    const { count } = this.db.prepare('SELECT COUNT(*) AS count FROM products').get();
    if (count > 0) return false;

    let legacy;
    try {
      legacy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return false;
    }
    if (!Array.isArray(legacy.products) || !Array.isArray(legacy.sales)) return false;

    const insertProduct = this.db.prepare(`
      INSERT INTO products (id, name, price, cost_price, category, stock, min_stock, sku, barcode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSale = this.db.prepare(`
      INSERT INTO sales (id, total, payment_method, created_at) VALUES (?, ?, ?, ?)
    `);
    const insertItem = this.db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const product of legacy.products) {
      insertProduct.run(
        product.id,
        product.name,
        product.price,
        product.cost_price || 0,
        product.category ?? null,
        product.stock,
        product.min_stock || 5,
        product.sku ?? null,
        product.barcode ?? null,
        product.created_at || new Date().toISOString(),
      );
    }
    for (const sale of legacy.sales) {
      insertSale.run(sale.id, sale.total, sale.payment_method, sale.created_at);
      for (const item of sale.items || []) {
        const product = legacy.products.find(candidate => candidate.id === item.productId);
        insertItem.run(
          sale.id,
          product ? item.productId : null,
          item.productName || item.name || product?.name || 'Unknown',
          item.quantity,
          item.price,
        );
      }
    }

    return true;
  }

  seedProducts() {
    const { count } = this.db.prepare('SELECT COUNT(*) AS count FROM products').get();
    if (count > 0) return;

    const insert = this.db.prepare(`
      INSERT INTO products (name, price, cost_price, category, stock, min_stock, sku, barcode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();

    for (const product of DEFAULT_PRODUCTS) {
      insert.run(
        product.name,
        product.price,
        product.cost_price || 0,
        product.category,
        product.stock,
        product.min_stock || 5,
        product.sku || null,
        product.barcode,
        now
      );
    }
  }

  seedDefaults() {
    // Seed default settings into app_metadata if not present
    const insertSetting = this.db.prepare(`
      INSERT OR IGNORE INTO app_metadata (key, value) VALUES (?, ?)
    `);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(k, String(v));
    }

    // Seed default customers
    const { customerCount } = this.db.prepare('SELECT COUNT(*) AS customerCount FROM customers').get();
    if (customerCount === 0) {
      const insertCust = this.db.prepare(`
        INSERT INTO customers (name, phone, email, address, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      insertCust.run('Walk-in Customer', '', '', '', 'General retail customer', now);
      insertCust.run('Acme Corp (Wholesale)', '+1 (555) 234-5678', 'procurement@acme.com', '124 Industrial Way', 'Corporate client (NET 30)', now);
      insertCust.run('Jane Doe', '+1 (555) 876-5432', 'jane.doe@example.com', '742 Evergreen Terrace', 'Loyalty club member', now);
    }

    // Seed default suppliers
    const { supplierCount } = this.db.prepare('SELECT COUNT(*) AS supplierCount FROM suppliers').get();
    if (supplierCount === 0) {
      const insertSupp = this.db.prepare(`
        INSERT INTO suppliers (name, contact_person, phone, email, address, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      insertSupp.run('Apex Beverage Supply', 'Marcus Vance', '+1 (555) 789-0123', 'orders@apexbev.com', '45 Logistics Park', now);
      insertSupp.run('Fresh Farms & Bakery Wholesale', 'Elena Rostova', '+1 (555) 456-7890', 'sales@freshfarms.com', '12 Orchard Lane', now);
    }
  }

  runTransaction(operation) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // --- Products ---

  getProducts() {
    return this.db.prepare(`
      SELECT id, name, price, cost_price, category, stock, min_stock, sku, barcode, supplier_id, created_at
      FROM products
      ORDER BY COALESCE(category, ''), name
    `).all();
  }

  getProductById(id) {
    if (!Number.isInteger(id)) return null;
    return this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
  }

  searchProducts(query) {
    const term = `%${String(query).trim()}%`;
    return this.db.prepare(`
      SELECT id, name, price, cost_price, category, stock, min_stock, sku, barcode, supplier_id, created_at
      FROM products
      WHERE name LIKE ? COLLATE NOCASE OR barcode LIKE ? OR sku LIKE ? COLLATE NOCASE
      ORDER BY name
    `).all(term, term, term);
  }

  normalizeProduct(product) {
    if (!product || typeof product !== 'object') throw new Error('Product data is required');
    const name = String(product.name || '').trim();
    const price = Number(product.price);
    const stock = Number(product.stock);
    if (!name) throw new Error('Product name is required');
    if (!Number.isFinite(price) || price < 0) throw new Error('Product price must be zero or greater');
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Product stock must be a non-negative integer');

    const cost_price = product.cost_price !== undefined && product.cost_price !== null && product.cost_price !== ''
      ? Number(product.cost_price)
      : 0;
    if (!Number.isFinite(cost_price) || cost_price < 0) throw new Error('Cost price must be zero or greater');

    const min_stock = product.min_stock !== undefined && product.min_stock !== null && product.min_stock !== ''
      ? Number(product.min_stock)
      : 5;
    if (!Number.isInteger(min_stock) || min_stock < 0) throw new Error('Min stock must be a non-negative integer');

    return {
      name,
      price,
      cost_price,
      stock,
      min_stock,
      category: String(product.category || '').trim() || null,
      barcode: String(product.barcode || '').trim() || null,
      sku: String(product.sku || '').trim() || null,
      supplier_id: product.supplier_id ? Number(product.supplier_id) : null,
    };
  }

  createProduct(product) {
    const input = this.normalizeProduct(product);
    const createdAt = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO products (name, price, cost_price, category, stock, min_stock, sku, barcode, supplier_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.name,
      input.price,
      input.cost_price,
      input.category,
      input.stock,
      input.min_stock,
      input.sku,
      input.barcode,
      input.supplier_id,
      createdAt
    );
    return this.getProductById(Number(result.lastInsertRowid));
  }

  updateProduct(product) {
    const input = this.normalizeProduct(product);
    if (!Number.isInteger(product.id)) throw new Error('Invalid product ID');
    const result = this.db.prepare(`
      UPDATE products
      SET name = ?, price = ?, cost_price = ?, category = ?, stock = ?, min_stock = ?, sku = ?, barcode = ?, supplier_id = ?
      WHERE id = ?
    `).run(
      input.name,
      input.price,
      input.cost_price,
      input.category,
      input.stock,
      input.min_stock,
      input.sku,
      input.barcode,
      input.supplier_id,
      product.id
    );

    if (result.changes === 0) throw new Error('Product not found');
    return this.getProductById(product.id);
  }

  deleteProduct(id) {
    if (!Number.isInteger(id)) return { success: false };
    return { success: this.db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0 };
  }

  updateStock(id, quantity) {
    if (!Number.isInteger(id)) return { success: false };
    if (!Number.isInteger(quantity)) throw new Error('Stock adjustment must be an integer');
    const result = this.db.prepare(`
      UPDATE products
      SET stock = MAX(0, stock + ?)
      WHERE id = ?
    `).run(quantity, id);
    return { success: result.changes > 0 };
  }

  adjustStock({ productId, quantity, type = 'adjustment', reference = '', notes = '' }) {
    if (!Number.isInteger(productId)) throw new Error('Invalid product ID');
    if (!Number.isInteger(quantity) || quantity === 0) throw new Error('Adjustment quantity must be non-zero integer');

    return this.runTransaction(() => {
      const product = this.getProductById(productId);
      if (!product) throw new Error('Product not found');
      const newStock = Math.max(0, product.stock + quantity);
      this.db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, productId);

      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, reference, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(productId, type, quantity, reference || 'Stock Adjustment', notes || '', now);

      return { success: true, newStock };
    });
  }

  getStockMovements(productId = null, limit = 100) {
    if (productId && Number.isInteger(productId)) {
      return this.db.prepare(`
        SELECT m.*, p.name AS product_name, p.sku AS product_sku
        FROM stock_movements m
        JOIN products p ON m.product_id = p.id
        WHERE m.product_id = ?
        ORDER BY m.id DESC LIMIT ?
      `).all(productId, limit);
    }
    return this.db.prepare(`
      SELECT m.*, p.name AS product_name, p.sku AS product_sku
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      ORDER BY m.id DESC LIMIT ?
    `).all(limit);
  }

  // --- Sales ---

  createSale(sale) {
    const paymentMethod = String(sale?.paymentMethod || '').trim();
    const validMethods = ['cash', 'card', 'mobile', 'bank_transfer', 'credit'];
    if (!validMethods.includes(paymentMethod)) throw new Error('Invalid payment method');
    if (!Array.isArray(sale?.items) || sale.items.length === 0) throw new Error('A sale must contain at least one item');

    const quantities = new Map();
    for (const item of sale.items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Invalid sale item');
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }

    return this.runTransaction(() => {
      const productStatement = this.db.prepare('SELECT id, name, price, cost_price, stock FROM products WHERE id = ?');
      const items = [...quantities].map(([productId, quantity]) => {
        const product = productStatement.get(productId);
        if (!product) throw new Error(`Product ${productId} not found`);
        if (product.stock < quantity) throw new Error(`Not enough stock for ${product.name}`);
        return {
          productId,
          quantity,
          price: product.price,
          costPrice: product.cost_price || 0,
          productName: product.name,
        };
      });

      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const discount = Number(sale.discount || 0);
      const discountType = String(sale.discountType || sale.discount_type || 'fixed');
      const discountRate = Number(sale.discountRate || sale.discount_rate || 0);
      const discountReason = sale.discountReason || sale.discount_reason ? String(sale.discountReason || sale.discount_reason) : null;
      const discountedSubtotal = Math.max(0, subtotal - discount);

      // Determine tax rate
      let taxRate = 8;
      if (sale.taxRate !== undefined && Number.isFinite(Number(sale.taxRate))) {
        taxRate = Number(sale.taxRate);
      } else {
        const taxSetting = this.db.prepare("SELECT value FROM app_metadata WHERE key = 'tax_rate'").get();
        if (taxSetting && Number.isFinite(Number(taxSetting.value))) {
          taxRate = Number(taxSetting.value);
        }
      }

      const taxAmount = Math.round(discountedSubtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((discountedSubtotal + taxAmount) * 100) / 100;
      const createdAt = sale.createdAt || new Date().toISOString();
      const customerId = sale.customerId ? Number(sale.customerId) : null;
      const customerName = sale.customerName ? String(sale.customerName) : null;
      const notes = sale.notes ? String(sale.notes) : null;

      const saleResult = this.db.prepare(`
        INSERT INTO sales (total, payment_method, customer_id, customer_name, subtotal, tax, discount, discount_type, discount_rate, discount_reason, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `).run(total, paymentMethod, customerId, customerName, subtotal, taxAmount, discount, discountType, discountRate, discountReason, notes, createdAt);

      const saleId = Number(saleResult.lastInsertRowid);

      // Handle store credit / loan if paid by credit
      let previousDebt = 0;
      let newDebt = 0;
      let creditLimitVal = 0;
      if (paymentMethod === 'credit') {
        if (!customerId) throw new Error('A registered customer must be selected to purchase on credit');
        const customer = this.getCustomerById(customerId);
        if (!customer) throw new Error('Customer not found');
        const currentBalance = Number(customer.credit_balance || 0);
        previousDebt = Number(customer.outstanding_debt || 0);
        creditLimitVal = Number(customer.credit_limit || 0);
        const available = currentBalance + creditLimitVal;
        if (total > available) {
          throw new Error(`Customer credit limit exceeded (Available: ${available.toFixed(2)}, Required: ${total.toFixed(2)})`);
        }
        const newBalance = Math.round((currentBalance - total) * 100) / 100;
        newDebt = Math.round((previousDebt + total) * 100) / 100;
        this.db.prepare('UPDATE customers SET credit_balance = ?, outstanding_debt = ? WHERE id = ?').run(newBalance, newDebt, customerId);
        this.db.prepare(`
          INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference, notes, created_at)
          VALUES (?, 'sale', ?, ?, ?, ?, ?)
        `).run(customerId, -total, newBalance, `Sale #${saleId}`, `Items taken on store loan (Pay Later)`, createdAt);
      }

      const insertItem = this.db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, discount)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const decreaseStock = this.db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      const recordMovement = this.db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, reference, notes, created_at)
        VALUES (?, 'sale', ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(saleId, item.productId, item.productName, item.quantity, item.price, 0);
        decreaseStock.run(item.quantity, item.productId);
        recordMovement.run(item.productId, -item.quantity, `Sale #${saleId}`, `Sale via ${paymentMethod}`, createdAt);
      }

      return {
        id: saleId,
        total,
        subtotal,
        tax: taxAmount,
        discount,
        discount_type: discountType,
        discount_rate: discountRate,
        discount_reason: discountReason,
        payment_method: paymentMethod,
        customer_id: customerId,
        customer_name: customerName,
        previous_debt: previousDebt,
        new_debt: newDebt,
        credit_limit: creditLimitVal,
        created_at: createdAt,
        items: items.map(item => ({
          productId: item.productId,
          name: item.productName,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        })),
      };
    });
  }

  refundSale(saleId, reason = 'Customer Refund') {
    if (!Number.isInteger(saleId)) throw new Error('Invalid sale ID');
    return this.runTransaction(() => {
      const sale = this.getSaleById(saleId);
      if (!sale) throw new Error('Sale not found');
      if (sale.status === 'refunded') throw new Error('Sale has already been refunded');

      this.db.prepare(`
        UPDATE sales SET status = 'refunded', notes = COALESCE(notes || ' | ', '') || ? WHERE id = ?
      `).run(`Refund: ${reason}`, saleId);

      const restoreStock = this.db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
      const recordMovement = this.db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, reference, notes, created_at)
        VALUES (?, 'return', ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();

      for (const item of sale.items) {
        if (item.productId) {
          restoreStock.run(item.quantity, item.productId);
          recordMovement.run(item.productId, item.quantity, `Refund #${saleId}`, reason, now);
        }
      }

      // Restore customer credit & reverse loan debt if paid by credit
      if (sale.payment_method === 'credit' && sale.customer_id) {
        const customer = this.getCustomerById(sale.customer_id);
        if (customer) {
          const restored = Math.round((Number(customer.credit_balance || 0) + sale.total) * 100) / 100;
          const restoredDebt = Math.max(0, Math.round((Number(customer.outstanding_debt || 0) - sale.total) * 100) / 100);
          this.db.prepare('UPDATE customers SET credit_balance = ?, outstanding_debt = ? WHERE id = ?').run(restored, restoredDebt, sale.customer_id);
          this.db.prepare(`
            INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference, notes, created_at)
            VALUES (?, 'refund', ?, ?, ?, ?, ?)
          `).run(sale.customer_id, sale.total, restored, `Refund #${saleId}`, reason || 'Refund reversal', now);
        }
      }

      return { success: true, id: saleId };
    });
  }

  getSales() {
    const sales = this.db.prepare(`
      SELECT s.id, s.total, s.payment_method, s.customer_id, s.customer_name, 
             s.subtotal, s.tax, s.discount, s.discount_type, s.discount_rate, s.discount_reason,
             s.status, s.notes, s.created_at
      FROM sales s
      ORDER BY s.created_at DESC, s.id DESC
    `).all();
    const itemsStatement = this.db.prepare(`
      SELECT product_id AS productId, product_name AS name, product_name AS productName, quantity, price, discount
      FROM sale_items WHERE sale_id = ? ORDER BY id
    `);
    return sales.map(sale => ({ ...sale, items: itemsStatement.all(sale.id) }));
  }

  getSaleById(id) {
    if (!Number.isInteger(id)) return null;
    const sale = this.db.prepare(`
      SELECT s.id, s.total, s.payment_method, s.customer_id, s.customer_name, 
             s.subtotal, s.tax, s.discount, s.discount_type, s.discount_rate, s.discount_reason,
             s.status, s.notes, s.created_at
      FROM sales s WHERE s.id = ?
    `).get(id);
    if (!sale) return null;
    sale.items = this.db.prepare(`
      SELECT product_id AS productId, product_name AS name, product_name AS productName, quantity, price, discount
      FROM sale_items WHERE sale_id = ? ORDER BY id
    `).all(id);
    return sale;
  }

  getDailyTotal() {
    const today = new Date().toISOString().slice(0, 10);
    return this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total FROM sales
      WHERE substr(created_at, 1, 10) = ? AND (status IS NULL OR status != 'refunded')
    `).get(today);
  }

  getStats() {
    const today = new Date().toISOString().slice(0, 10);
    const sales = this.db.prepare(`
      SELECT COUNT(*) AS todaySalesCount, COALESCE(SUM(total), 0) AS todayTotal,
             COALESCE(SUM(discount), 0) AS todayDiscounts
      FROM sales WHERE substr(created_at, 1, 10) = ? AND (status IS NULL OR status != 'refunded')
    `).get(today);
    const products = this.db.prepare(`
      SELECT COUNT(*) AS totalProducts, 
             SUM(CASE WHEN stock <= COALESCE(min_stock, 5) THEN 1 ELSE 0 END) AS lowStockCount,
             COALESCE(SUM(stock * price), 0) AS totalRetailValue,
             COALESCE(SUM(stock * cost_price), 0) AS totalCostValue
      FROM products
    `).get();
    const customers = this.db.prepare('SELECT COUNT(*) AS totalCustomers FROM customers').get();
    const customerLoans = this.db.prepare(`
      SELECT COALESCE(SUM(outstanding_debt), 0) AS totalOutstandingLoans,
             SUM(CASE WHEN outstanding_debt > 0 THEN 1 ELSE 0 END) AS debtorsCount
      FROM customers
    `).get();
    const totalSales = this.db.prepare(`
      SELECT COUNT(*) AS totalCount, COALESCE(SUM(total), 0) AS allTimeTotal,
             COALESCE(SUM(discount), 0) AS allTimeDiscounts
      FROM sales WHERE status IS NULL OR status != 'refunded'
    `).get();

    const todayProfit = this.db.prepare(`
      SELECT COALESCE(SUM(si.quantity * (si.price - COALESCE(p.cost_price, 0))), 0) - COALESCE((SELECT SUM(discount) FROM sales WHERE substr(created_at, 1, 10) = ? AND (status IS NULL OR status != 'refunded')), 0) AS grossProfit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE substr(s.created_at, 1, 10) = ? AND (s.status IS NULL OR s.status != 'refunded')
    `).get(today, today);

    return {
      todaySalesCount: Number(sales.todaySalesCount),
      todayTotal: Number(sales.todayTotal),
      todayDiscounts: Number(sales.todayDiscounts || 0),
      totalProducts: Number(products.totalProducts),
      lowStockCount: Number(products.lowStockCount || 0),
      todayGrossProfit: Number(todayProfit.grossProfit || 0),
      totalInventoryRetail: Number(products.totalRetailValue || 0),
      totalInventoryCost: Number(products.totalCostValue || 0),
      totalCustomers: Number(customers.totalCustomers || 0),
      totalOutstandingLoans: Number(customerLoans?.totalOutstandingLoans || 0),
      debtorsCount: Number(customerLoans?.debtorsCount || 0),
      allTimeTotalRevenue: Number(totalSales.allTimeTotal || 0),
      allTimeOrdersCount: Number(totalSales.totalCount || 0),
      allTimeDiscounts: Number(totalSales.allTimeDiscounts || 0),
    };
  }

  // --- Settings ---

  getSettings() {
    const rows = this.db.prepare("SELECT key, value FROM app_metadata").all();
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (row.key !== 'initialized') {
        settings[row.key] = row.value;
      }
    }
    return settings;
  }

  updateSettings(updates) {
    const insertOrReplace = this.db.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    return this.runTransaction(() => {
      for (const [key, val] of Object.entries(updates)) {
        if (key !== 'initialized') {
          insertOrReplace.run(key, String(val ?? ''));
        }
      }
      return this.getSettings();
    });
  }

  // --- Customers ---

  getCustomers() {
    return this.db.prepare(`
      SELECT c.*, 
        COUNT(s.id) AS total_orders, 
        COALESCE(SUM(s.total), 0) AS total_spent
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id AND (s.status IS NULL OR s.status != 'refunded')
      GROUP BY c.id
      ORDER BY c.name
    `).all();
  }

  getCustomerById(id) {
    if (!Number.isInteger(id)) return null;
    return this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) || null;
  }

  createCustomer(customer) {
    const name = String(customer?.name || '').trim();
    if (!name) throw new Error('Customer name is required');
    const now = new Date().toISOString();
    const initialCredit = Number(customer.credit_balance || 0);
    const initialDebt = Math.max(0, Number(customer.outstanding_debt || 0));
    const creditLimit = Number(customer.credit_limit || 0);

    return this.runTransaction(() => {
      const res = this.db.prepare(`
        INSERT INTO customers (name, phone, email, address, notes, credit_balance, credit_limit, outstanding_debt, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        customer.phone || null,
        customer.email || null,
        customer.address || null,
        customer.notes || null,
        initialCredit,
        creditLimit,
        initialDebt,
        now
      );
      const customerId = Number(res.lastInsertRowid);

      if (initialCredit !== 0) {
        this.db.prepare(`
          INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference, notes, created_at)
          VALUES (?, 'opening_balance', ?, ?, 'Opening Credit', 'Initial credit balance on registration', ?)
        `).run(customerId, initialCredit, initialCredit, now);
      }

      if (initialDebt > 0) {
        this.db.prepare(`
          INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference, notes, created_at)
          VALUES (?, 'opening_loan', ?, ?, 'Opening Loan', 'Opening loan balance on registration', ?)
        `).run(customerId, -initialDebt, -initialDebt, now);
      }

      return this.getCustomerById(customerId);
    });
  }

  updateCustomer(customer) {
    if (!Number.isInteger(customer?.id)) throw new Error('Invalid customer ID');
    const name = String(customer.name || '').trim();
    if (!name) throw new Error('Customer name is required');
    const creditLimit = Number(customer.credit_limit || 0);
    const hasDebtUpdate = customer.outstanding_debt !== undefined && customer.outstanding_debt !== null;
    const debtVal = hasDebtUpdate ? Math.max(0, Number(customer.outstanding_debt)) : null;

    if (hasDebtUpdate) {
      this.db.prepare(`
        UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, credit_limit = ?, outstanding_debt = ? WHERE id = ?
      `).run(
        name,
        customer.phone || null,
        customer.email || null,
        customer.address || null,
        customer.notes || null,
        creditLimit,
        debtVal,
        customer.id
      );
    } else {
      this.db.prepare(`
        UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, credit_limit = ? WHERE id = ?
      `).run(
        name,
        customer.phone || null,
        customer.email || null,
        customer.address || null,
        customer.notes || null,
        creditLimit,
        customer.id
      );
    }
    return this.getCustomerById(customer.id);
  }

  recordLoanPayment({ customerId, amount, paymentMethod = 'cash', reference = '', notes = '' }) {
    if (!Number.isInteger(customerId)) throw new Error('Invalid customer ID');
    const payAmt = Number(amount);
    if (!Number.isFinite(payAmt) || payAmt <= 0) throw new Error('Payment amount must be greater than zero');

    return this.runTransaction(() => {
      const customer = this.getCustomerById(customerId);
      if (!customer) throw new Error('Customer not found');

      const currentDebt = Number(customer.outstanding_debt || 0);
      const currentBalance = Number(customer.credit_balance || 0);
      const newDebt = Math.max(0, Math.round((currentDebt - payAmt) * 100) / 100);
      const newBalance = Math.round((currentBalance + payAmt) * 100) / 100;
      const now = new Date().toISOString();
      const ref = reference || `LOAN-PAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const noteText = notes || `Loan repayment received via ${paymentMethod.toUpperCase()}`;

      this.db.prepare('UPDATE customers SET outstanding_debt = ?, credit_balance = ? WHERE id = ?')
        .run(newDebt, newBalance, customerId);

      const txResult = this.db.prepare(`
        INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference, notes, created_at)
        VALUES (?, 'loan_payment', ?, ?, ?, ?, ?)
      `).run(customerId, payAmt, newBalance, ref, noteText, now);

      return {
        success: true,
        transactionId: Number(txResult.lastInsertRowid),
        customerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        amountPaid: payAmt,
        previousDebt: currentDebt,
        remainingDebt: newDebt,
        paymentMethod,
        reference: ref,
        notes: noteText,
        paidAt: now,
      };
    });
  }

  addCustomerCredit({ customerId, amount, type = 'topup', reference = '', notes = '' }) {
    if (!Number.isInteger(customerId)) throw new Error('Invalid customer ID');
    const addAmt = Number(amount);
    if (!Number.isFinite(addAmt) || addAmt <= 0) throw new Error('Credit amount must be greater than zero');

    return this.runTransaction(() => {
      const customer = this.getCustomerById(customerId);
      if (!customer) throw new Error('Customer not found');

      const currentBalance = Number(customer.credit_balance || 0);
      const newBalance = Math.round((currentBalance + addAmt) * 100) / 100;
      this.db.prepare('UPDATE customers SET credit_balance = ? WHERE id = ?').run(newBalance, customerId);

      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, type, addAmt, newBalance, reference || 'Credit Top-up', notes || '', now);

      return {
        success: true,
        customerId,
        newBalance,
        addedAmount: addAmt,
      };
    });
  }

  deductCustomerCredit({ customerId, amount, type = 'charge', reference = '', notes = '' }) {
    if (!Number.isInteger(customerId)) throw new Error('Invalid customer ID');
    const deductAmt = Number(amount);
    if (!Number.isFinite(deductAmt) || deductAmt <= 0) throw new Error('Deduction amount must be greater than zero');

    return this.runTransaction(() => {
      const customer = this.getCustomerById(customerId);
      if (!customer) throw new Error('Customer not found');

      const currentBalance = Number(customer.credit_balance || 0);
      const creditLimit = Number(customer.credit_limit || 0);
      const available = currentBalance + creditLimit;

      if (deductAmt > available) {
        throw new Error(`Insufficient customer credit (Available: ${available.toFixed(2)}, Needed: ${deductAmt.toFixed(2)})`);
      }

      const newBalance = Math.round((currentBalance - deductAmt) * 100) / 100;
      this.db.prepare('UPDATE customers SET credit_balance = ? WHERE id = ?').run(newBalance, customerId);

      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO customer_transactions (customer_id, type, amount, balance_after, reference, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, type, -deductAmt, newBalance, reference || 'Credit Deduction', notes || '', now);

      return {
        success: true,
        customerId,
        newBalance,
      };
    });
  }

  getCustomerTransactions(customerId, limit = 50) {
    if (!Number.isInteger(customerId)) return [];
    return this.db.prepare(`
      SELECT * FROM customer_transactions
      WHERE customer_id = ?
      ORDER BY id DESC LIMIT ?
    `).all(customerId, limit);
  }

  deleteCustomer(id) {
    if (!Number.isInteger(id)) return { success: false };
    return { success: this.db.prepare('DELETE FROM customers WHERE id = ?').run(id).changes > 0 };
  }

  // --- Suppliers ---

  getSuppliers() {
    return this.db.prepare('SELECT * FROM suppliers ORDER BY name').all();
  }

  createSupplier(supplier) {
    const name = String(supplier?.name || '').trim();
    if (!name) throw new Error('Supplier name is required');
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      INSERT INTO suppliers (name, contact_person, phone, email, address, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, supplier.contact_person || null, supplier.phone || null, supplier.email || null, supplier.address || null, now);
    return this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(res.lastInsertRowid));
  }

  updateSupplier(supplier) {
    if (!Number.isInteger(supplier?.id)) throw new Error('Invalid supplier ID');
    const name = String(supplier.name || '').trim();
    if (!name) throw new Error('Supplier name is required');
    this.db.prepare(`
      UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ?
    `).run(name, supplier.contact_person || null, supplier.phone || null, supplier.email || null, supplier.address || null, supplier.id);
    return this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier.id);
  }

  deleteSupplier(id) {
    if (!Number.isInteger(id)) return { success: false };
    return { success: this.db.prepare('DELETE FROM suppliers WHERE id = ?').run(id).changes > 0 };
  }

  // --- Held / Parked Orders ---

  getHeldOrders() {
    const rows = this.db.prepare('SELECT * FROM held_orders ORDER BY id DESC').all();
    return rows.map(r => ({ ...r, items: JSON.parse(r.items_json) }));
  }

  saveHeldOrder({ reference, customerName, items, total, notes, discount = 0, discountType = 'fixed', discountRate = 0, discountReason = null }) {
    if (!reference) throw new Error('Reference label is required');
    if (!Array.isArray(items) || items.length === 0) throw new Error('Items required');
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO held_orders (reference, customer_name, items_json, total, notes, discount, discount_type, discount_rate, discount_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reference,
      customerName || null,
      JSON.stringify(items),
      Number(total) || 0,
      notes || null,
      Number(discount) || 0,
      discountType,
      Number(discountRate) || 0,
      discountReason,
      now
    );
    return { id: Number(result.lastInsertRowid), reference, total, discount, discountType, discountRate, discountReason, created_at: now };
  }

  deleteHeldOrder(id) {
    if (!Number.isInteger(id)) return { success: false };
    return { success: this.db.prepare('DELETE FROM held_orders WHERE id = ?').run(id).changes > 0 };
  }

  close() {
    try {
      this.db.close();
    } catch {
      // ignore if already closed
    }
  }
}

module.exports = { PosDatabase, DEFAULT_SETTINGS };
