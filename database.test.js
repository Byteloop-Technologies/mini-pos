const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PosDatabase } = require('./database');

function createTestDatabase(legacyData = null) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-pos-'));
  const databasePath = path.join(directory, 'test.sqlite');
  const legacyPath = legacyData ? path.join(directory, 'data.json') : null;

  if (legacyPath) fs.writeFileSync(legacyPath, JSON.stringify(legacyData));

  return { directory, databasePath, legacyPath, database: new PosDatabase(databasePath, legacyPath) };
}

test('persists products and completed sales', t => {
  const { directory, databasePath, database } = createTestDatabase();
  let reopened;
  t.after(() => {
    reopened?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const product = database.createProduct({
    name: 'Test Product',
    price: 10,
    category: 'Test',
    stock: 3,
    barcode: 'TEST-1',
  });

  const sale = database.createSale({
    paymentMethod: 'card',
    items: [{ productId: product.id, quantity: 2 }],
  });

  assert.equal(sale.total, 21.6);
  assert.equal(database.getProductById(product.id).stock, 1);
  database.close();

  reopened = new PosDatabase(databasePath);
  assert.equal(reopened.getProductById(product.id).stock, 1);
  assert.equal(reopened.getSales()[0].items[0].name, 'Test Product');
});

test('does not restore defaults after every product is deleted', t => {
  const { directory, databasePath, database } = createTestDatabase();
  let reopened;
  t.after(() => {
    reopened?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  for (const product of database.getProducts()) database.deleteProduct(product.id);
  assert.equal(database.getProducts().length, 0);
  database.close();

  reopened = new PosDatabase(databasePath);
  assert.equal(reopened.getProducts().length, 0);
});

test('keeps sale history after a product is deleted', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const product = database.createProduct({ name: 'Historical', price: 5, stock: 2 });
  const sale = database.createSale({
    paymentMethod: 'cash',
    items: [{ productId: product.id, quantity: 1 }],
  });

  assert.equal(database.deleteProduct(product.id).success, true);
  assert.equal(database.getSaleById(sale.id).items[0].name, 'Historical');
  assert.equal(database.getSaleById(sale.id).items[0].productId, null);
});

test('combines duplicate sale lines before checking stock', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const product = database.createProduct({ name: 'Limited', price: 2, stock: 1 });

  assert.throws(() => database.createSale({
    paymentMethod: 'cash',
    items: [
      { productId: product.id, quantity: 1 },
      { productId: product.id, quantity: 1 },
    ],
  }), /Not enough stock/);
  assert.equal(database.getProductById(product.id).stock, 1);
});

test('rolls back an entire sale when stock is insufficient', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const product = database.createProduct({ name: 'Limited', price: 2, stock: 1 });
  const salesBefore = database.getSales().length;

  assert.throws(
    () => database.createSale({
      paymentMethod: 'cash',
      items: [{ productId: product.id, quantity: 2 }],
    }),
    /Not enough stock/,
  );
  assert.equal(database.getProductById(product.id).stock, 1);
  assert.equal(database.getSales().length, salesBefore);
});

test('imports the legacy JSON store once', t => {
  const legacyData = {
    products: [{
      id: 20,
      name: 'Legacy Product',
      price: 1.5,
      category: null,
      stock: 7,
      barcode: 'LEGACY-1',
      created_at: '2026-01-01T00:00:00.000Z',
    }],
    sales: [{
      id: 10,
      total: 1.62,
      payment_method: 'cash',
      created_at: '2026-01-01T00:00:00.000Z',
      items: [{ productId: 20, productName: 'Legacy Product', quantity: 1, price: 1.5 }],
    }],
  };
  const { directory, database, legacyPath } = createTestDatabase(legacyData);
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  assert.equal(database.getProductById(20).name, 'Legacy Product');
  assert.equal(database.getSaleById(10).items[0].name, 'Legacy Product');
  assert.equal(fs.existsSync(`${legacyPath}.migrated`), true);
  assert.equal(fs.existsSync(legacyPath), false);
});

test('persists settings updates including currency and store details', t => {
  const { directory, database, databasePath } = createTestDatabase();
  let reopened;
  t.after(() => {
    database.close();
    reopened?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const initial = database.getSettings();
  assert.equal(initial.currency_symbol, '$');
  assert.equal(initial.currency_code, 'USD');

  database.updateSettings({
    currency_code: 'EUR',
    currency_symbol: '€',
    currency_position: 'suffix',
    store_name: 'Metro Supermarket',
    tax_rate: '19',
  });

  const updated = database.getSettings();
  assert.equal(updated.currency_code, 'EUR');
  assert.equal(updated.currency_symbol, '€');
  assert.equal(updated.currency_position, 'suffix');
  assert.equal(updated.store_name, 'Metro Supermarket');
  assert.equal(updated.tax_rate, '19');

  database.close();
  reopened = new PosDatabase(databasePath);
  assert.equal(reopened.getSettings().currency_symbol, '€');
  assert.equal(reopened.getSettings().tax_rate, '19');
});

test('supports stock adjustments and logs movement audit trail', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const product = database.createProduct({
    name: 'Audit Item',
    price: 15,
    cost_price: 8,
    stock: 20,
    sku: 'SKU-AUD-1',
  });

  const adj = database.adjustStock({
    productId: product.id,
    quantity: 10,
    type: 'in',
    reference: 'PO-9001',
    notes: 'Received from supplier',
  });

  assert.equal(adj.newStock, 30);
  assert.equal(database.getProductById(product.id).stock, 30);

  const movements = database.getStockMovements(product.id);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].type, 'in');
  assert.equal(movements[0].quantity, 10);
  assert.equal(movements[0].reference, 'PO-9001');
});

test('manages customers and attaches them to sales', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const customer = database.createCustomer({
    name: 'Alice Johnson',
    phone: '+1 555 4321',
    email: 'alice@example.com',
  });
  assert.equal(customer.name, 'Alice Johnson');

  const product = database.createProduct({ name: 'Gadget', price: 50, stock: 10 });
  const sale = database.createSale({
    paymentMethod: 'card',
    customerId: customer.id,
    customerName: customer.name,
    items: [{ productId: product.id, quantity: 1 }],
  });

  assert.equal(sale.customer_id, customer.id);
  assert.equal(sale.customer_name, 'Alice Johnson');

  const customerSales = database.getCustomers().find(c => c.id === customer.id);
  assert.equal(customerSales.total_orders, 1);
});

test('handles park order (held orders) lifecycle', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const held = database.saveHeldOrder({
    reference: 'Table 4',
    customerName: 'Bob',
    items: [{ productId: 1, name: 'Coffee', quantity: 2, price: 2.5 }],
    total: 5.4,
    notes: 'Takeaway after meeting',
  });

  assert.equal(held.reference, 'Table 4');
  const allHeld = database.getHeldOrders();
  assert.equal(allHeld.length, 1);
  assert.equal(allHeld[0].items[0].name, 'Coffee');

  assert.equal(database.deleteHeldOrder(held.id).success, true);
  assert.equal(database.getHeldOrders().length, 0);
});

test('processes sale refund and restores inventory', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const product = database.createProduct({ name: 'Refundable Widget', price: 20, stock: 5 });
  const sale = database.createSale({
    paymentMethod: 'cash',
    items: [{ productId: product.id, quantity: 2 }],
  });

  assert.equal(database.getProductById(product.id).stock, 3);

  const refundResult = database.refundSale(sale.id, 'Customer changed mind');
  assert.equal(refundResult.success, true);
  assert.equal(database.getProductById(product.id).stock, 5);
  assert.equal(database.getSaleById(sale.id).status, 'refunded');
});

test('supports customer credit top-ups, limits, and store credit purchases', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const customer = database.createCustomer({
    name: 'Credit Customer',
    credit_balance: 50,
    credit_limit: 100,
  });

  assert.equal(customer.credit_balance, 50);
  assert.equal(customer.credit_limit, 100);

  // Top up credit by $30
  const topup = database.addCustomerCredit({
    customerId: customer.id,
    amount: 30,
    type: 'topup',
    reference: 'DEP-101',
    notes: 'Cash topup',
  });
  assert.equal(topup.newBalance, 80);
  assert.equal(database.getCustomerById(customer.id).credit_balance, 80);

  // Purchase on credit
  const product = database.createProduct({ name: 'Credit Item', price: 20, stock: 5 });
  const sale = database.createSale({
    paymentMethod: 'credit',
    customerId: customer.id,
    customerName: customer.name,
    items: [{ productId: product.id, quantity: 1 }],
  });
  // price 20 * 1.08 tax = 21.6
  assert.equal(sale.total, 21.6);
  // Balance was 80 - 21.6 = 58.4
  assert.equal(database.getCustomerById(customer.id).credit_balance, 58.4);

  // Verify transaction ledger
  const txs = database.getCustomerTransactions(customer.id);
  assert.equal(txs.length, 3); // opening, topup, sale
  assert.equal(txs[0].type, 'sale');
  assert.equal(txs[0].amount, -21.6);
  assert.equal(txs[1].type, 'topup');
  assert.equal(txs[1].amount, 30);

  // Refunding the credit sale restores customer balance
  database.refundSale(sale.id, 'Return item');
  assert.equal(database.getCustomerById(customer.id).credit_balance, 80);
});

test('handles shop owner giving items on loan and customer repaying debt after payment', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  // Shop owner registers regular customer with loan limit of $200 and initial zero debt
  const customer = database.createCustomer({
    name: 'Robert Udhar',
    phone: '+1 555-0987',
    credit_limit: 200,
    outstanding_debt: 0,
  });

  assert.equal(customer.outstanding_debt, 0);
  assert.equal(customer.credit_limit, 200);

  // Shop owner gives items on loan (customer takes item now, pays later)
  const product = database.createProduct({ name: 'Bag of Rice 10kg', price: 40, stock: 10 });
  const sale = database.createSale({
    paymentMethod: 'credit',
    customerId: customer.id,
    customerName: customer.name,
    items: [{ productId: product.id, quantity: 1 }],
  });

  // 40 * 1.08 tax = 43.2
  assert.equal(sale.total, 43.2);
  const updatedCust = database.getCustomerById(customer.id);
  assert.equal(updatedCust.outstanding_debt, 43.2);

  // Verify stats show loan
  const stats = database.getStats();
  assert.equal(stats.totalOutstandingLoans, 43.2);
  assert.equal(stats.debtorsCount, 1);

  // Customer comes back later and makes a partial loan payment ("after payment") of $25 cash
  const payment1 = database.recordLoanPayment({
    customerId: customer.id,
    amount: 25,
    paymentMethod: 'cash',
    reference: 'LPAY-001',
    notes: 'First installment cash',
  });

  assert.equal(payment1.success, true);
  assert.equal(payment1.amountPaid, 25);
  assert.equal(payment1.previousDebt, 43.2);
  assert.equal(payment1.remainingDebt, 18.2);
  assert.equal(database.getCustomerById(customer.id).outstanding_debt, 18.2);

  // Customer pays the remaining $18.20 via card to fully settle the loan
  const payment2 = database.recordLoanPayment({
    customerId: customer.id,
    amount: 18.2,
    paymentMethod: 'card',
    reference: 'LPAY-002',
    notes: 'Final payoff via card',
  });

  assert.equal(payment2.remainingDebt, 0);
  assert.equal(database.getCustomerById(customer.id).outstanding_debt, 0);

  // Verify transactions ledger contains loan sale and repayments
  const txs = database.getCustomerTransactions(customer.id);
  assert.equal(txs[0].type, 'loan_payment');
  assert.equal(txs[0].amount, 18.2);
  assert.equal(txs[1].type, 'loan_payment');
  assert.equal(txs[1].amount, 25);
  assert.equal(txs[2].type, 'sale');
  assert.equal(txs[2].amount, -43.2);
});

test('handles discount module with percentage and fixed discounts on sales', t => {
  const { directory, database } = createTestDatabase();
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const p1 = database.createProduct({ name: 'Headphones', price: 100, cost_price: 40, stock: 10 });

  // Sale with 10% discount ($10 off subtotal of $100, tax 8% on $90 = $7.20, total = $97.20)
  const sale = database.createSale({
    paymentMethod: 'cash',
    items: [{ productId: p1.id, quantity: 1 }],
    discount: 10,
    discountType: 'percentage',
    discountRate: 10,
    discountReason: 'VIP Customer 10%',
    taxRate: 8,
  });

  assert.equal(sale.subtotal, 100);
  assert.equal(sale.discount, 10);
  assert.equal(sale.discount_type, 'percentage');
  assert.equal(sale.discount_rate, 10);
  assert.equal(sale.discount_reason, 'VIP Customer 10%');
  assert.equal(sale.tax, 7.2);
  assert.equal(sale.total, 97.2);

  // Check stats reflect discount
  const stats = database.getStats();
  assert.equal(stats.todayDiscounts, 10);
  assert.equal(stats.allTimeDiscounts, 10);
  // Revenue 97.20, Cost 40, profit = (100 - 40) - 10 = 50
  assert.equal(stats.todayGrossProfit, 50);

  // Check sales record retrieval includes discount details
  const retrievedSale = database.getSaleById(sale.id);
  assert.equal(retrievedSale.discount, 10);
  assert.equal(retrievedSale.discount_reason, 'VIP Customer 10%');

  // Verify held order with discount preserves discount metadata
  const held = database.saveHeldOrder({
    reference: 'HOLD-DISC-1',
    customerName: 'Alice',
    items: [{ productId: p1.id, quantity: 1, price: 100 }],
    total: 97.2,
    discount: 10,
    discountType: 'percentage',
    discountRate: 10,
    discountReason: 'Staff Promo',
  });
  assert.equal(held.discount, 10);
  assert.equal(held.discountType, 'percentage');
  assert.equal(held.discountReason, 'Staff Promo');
});




