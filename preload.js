const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  products: {
    getAll: () => ipcRenderer.invoke('db:products:getAll'),
    getById: (id) => ipcRenderer.invoke('db:products:getById', id),
    search: (query) => ipcRenderer.invoke('db:products:search', query),
    create: (product) => ipcRenderer.invoke('db:products:create', product),
    update: (product) => ipcRenderer.invoke('db:products:update', product),
    delete: (id) => ipcRenderer.invoke('db:products:delete', id),
    updateStock: (id, quantity) => ipcRenderer.invoke('db:products:updateStock', id, quantity),
    adjustStock: (adjustment) => ipcRenderer.invoke('db:products:adjustStock', adjustment),
    getMovements: (productId) => ipcRenderer.invoke('db:products:getMovements', productId),
  },
  sales: {
    create: (sale) => ipcRenderer.invoke('db:sales:create', sale),
    getAll: () => ipcRenderer.invoke('db:sales:getAll'),
    getById: (id) => ipcRenderer.invoke('db:sales:getById', id),
    refund: (id, reason) => ipcRenderer.invoke('db:sales:refund', id, reason),
    getDailyTotal: () => ipcRenderer.invoke('db:sales:getDailyTotal'),
    getStats: () => ipcRenderer.invoke('db:sales:getStats'),
  },
  settings: {
    get: () => ipcRenderer.invoke('db:settings:get'),
    update: (settings) => ipcRenderer.invoke('db:settings:update', settings),
  },
  customers: {
    getAll: () => ipcRenderer.invoke('db:customers:getAll'),
    getById: (id) => ipcRenderer.invoke('db:customers:getById', id),
    create: (customer) => ipcRenderer.invoke('db:customers:create', customer),
    update: (customer) => ipcRenderer.invoke('db:customers:update', customer),
    delete: (id) => ipcRenderer.invoke('db:customers:delete', id),
    addCredit: (payload) => ipcRenderer.invoke('db:customers:addCredit', payload),
    deductCredit: (payload) => ipcRenderer.invoke('db:customers:deductCredit', payload),
    payLoan: (payload) => ipcRenderer.invoke('db:customers:payLoan', payload),
    getTransactions: (id) => ipcRenderer.invoke('db:customers:getTransactions', id),
  },
  suppliers: {
    getAll: () => ipcRenderer.invoke('db:suppliers:getAll'),
    create: (supplier) => ipcRenderer.invoke('db:suppliers:create', supplier),
    update: (supplier) => ipcRenderer.invoke('db:suppliers:update', supplier),
    delete: (id) => ipcRenderer.invoke('db:suppliers:delete', id),
  },
  heldOrders: {
    getAll: () => ipcRenderer.invoke('db:heldOrders:getAll'),
    save: (order) => ipcRenderer.invoke('db:heldOrders:save', order),
    delete: (id) => ipcRenderer.invoke('db:heldOrders:delete', id),
  },
  printer: {
    getList: () => ipcRenderer.invoke('printer:getList'),
    printThermal: (payload) => ipcRenderer.invoke('printer:printThermal', payload),
  },
});
