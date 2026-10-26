// Bridge to Electron window.api with browser mock fallback for standalone dev / testing

const isElectron = typeof window !== 'undefined' && Boolean(window.api);

export const api = {
  products: {
    getAll: async () => (isElectron ? window.api.products.getAll() : []),
    getById: async (id) => (isElectron ? window.api.products.getById(id) : null),
    search: async (query) => (isElectron ? window.api.products.search(query) : []),
    create: async (product) => (isElectron ? window.api.products.create(product) : product),
    update: async (product) => (isElectron ? window.api.products.update(product) : product),
    delete: async (id) => (isElectron ? window.api.products.delete(id) : { success: true }),
    updateStock: async (id, qty) => (isElectron ? window.api.products.updateStock(id, qty) : { success: true }),
    adjustStock: async (adj) => (isElectron ? window.api.products.adjustStock(adj) : { success: true }),
    getMovements: async (id) => (isElectron ? window.api.products.getMovements(id) : []),
  },
  sales: {
    create: async (sale) => (isElectron ? window.api.sales.create(sale) : { id: 1, ...sale }),
    getAll: async () => (isElectron ? window.api.sales.getAll() : []),
    getById: async (id) => (isElectron ? window.api.sales.getById(id) : null),
    refund: async (id, reason) => (isElectron ? window.api.sales.refund(id, reason) : { success: true }),
    getDailyTotal: async () => (isElectron ? window.api.sales.getDailyTotal() : { total: 0 }),
    getStats: async () => (isElectron ? window.api.sales.getStats() : { todaySalesCount: 0, todayTotal: 0, totalProducts: 0, lowStockCount: 0 }),
  },
  settings: {
    get: async () => (isElectron ? window.api.settings.get() : {
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
      receipt_footer: 'Thank you for your business.',
      low_stock_threshold: '5',
    }),
    update: async (settings) => (isElectron ? window.api.settings.update(settings) : settings),
  },
  customers: {
    getAll: async () => (isElectron ? window.api.customers.getAll() : []),
    getById: async (id) => (isElectron ? window.api.customers.getById(id) : null),
    create: async (cust) => (isElectron ? window.api.customers.create(cust) : cust),
    update: async (cust) => (isElectron ? window.api.customers.update(cust) : cust),
    delete: async (id) => (isElectron ? window.api.customers.delete(id) : { success: true }),
    addCredit: async (payload) => (isElectron ? window.api.customers.addCredit(payload) : { success: true, newBalance: payload.amount }),
    deductCredit: async (payload) => (isElectron ? window.api.customers.deductCredit(payload) : { success: true }),
    payLoan: async (payload) => (isElectron ? window.api.customers.payLoan(payload) : { success: true, remainingDebt: 0 }),
    getTransactions: async (id) => (isElectron ? window.api.customers.getTransactions(id) : []),
  },
  suppliers: {
    getAll: async () => (isElectron ? window.api.suppliers.getAll() : []),
    create: async (supp) => (isElectron ? window.api.suppliers.create(supp) : supp),
    update: async (supp) => (isElectron ? window.api.suppliers.update(supp) : supp),
    delete: async (id) => (isElectron ? window.api.suppliers.delete(id) : { success: true }),
  },
  heldOrders: {
    getAll: async () => (isElectron ? window.api.heldOrders.getAll() : []),
    save: async (order) => (isElectron ? window.api.heldOrders.save(order) : { id: 1, ...order }),
    delete: async (id) => (isElectron ? window.api.heldOrders.delete(id) : { success: true }),
  },
  printer: {
    getList: async () => (isElectron && window.api.printer?.getList ? window.api.printer.getList() : []),
    printThermal: async (payload) => {
      if (isElectron && window.api.printer?.printThermal) {
        return window.api.printer.printThermal(payload);
      }
      // Fallback for non-Electron / browser environments
      window.print();
      return { success: true };
    },
  },
};
