const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { PosDatabase } = require('./database');

const isDev = process.argv.includes('--dev');
let database;

function registerDatabaseHandlers() {
  // Products & Inventory
  ipcMain.handle('db:products:getAll', () => database.getProducts());
  ipcMain.handle('db:products:getById', (_, id) => database.getProductById(id));
  ipcMain.handle('db:products:search', (_, query) => database.searchProducts(query));
  ipcMain.handle('db:products:create', (_, product) => database.createProduct(product));
  ipcMain.handle('db:products:update', (_, product) => database.updateProduct(product));
  ipcMain.handle('db:products:delete', (_, id) => database.deleteProduct(id));
  ipcMain.handle('db:products:updateStock', (_, id, quantity) => database.updateStock(id, quantity));
  ipcMain.handle('db:products:adjustStock', (_, adjustment) => database.adjustStock(adjustment));
  ipcMain.handle('db:products:getMovements', (_, productId) => database.getStockMovements(productId));

  // Sales
  ipcMain.handle('db:sales:create', (_, sale) => database.createSale(sale));
  ipcMain.handle('db:sales:getAll', () => database.getSales());
  ipcMain.handle('db:sales:getById', (_, id) => database.getSaleById(id));
  ipcMain.handle('db:sales:refund', (_, id, reason) => database.refundSale(id, reason));
  ipcMain.handle('db:sales:getDailyTotal', () => database.getDailyTotal());
  ipcMain.handle('db:sales:getStats', () => database.getStats());

  // Settings & Configuration
  ipcMain.handle('db:settings:get', () => database.getSettings());
  ipcMain.handle('db:settings:update', (_, settings) => database.updateSettings(settings));

  // Customers & CRM
  ipcMain.handle('db:customers:getAll', () => database.getCustomers());
  ipcMain.handle('db:customers:getById', (_, id) => database.getCustomerById(id));
  ipcMain.handle('db:customers:create', (_, customer) => database.createCustomer(customer));
  ipcMain.handle('db:customers:update', (_, customer) => database.updateCustomer(customer));
  ipcMain.handle('db:customers:delete', (_, id) => database.deleteCustomer(id));
  ipcMain.handle('db:customers:addCredit', (_, payload) => database.addCustomerCredit(payload));
  ipcMain.handle('db:customers:deductCredit', (_, payload) => database.deductCustomerCredit(payload));
  ipcMain.handle('db:customers:payLoan', (_, payload) => database.recordLoanPayment(payload));
  ipcMain.handle('db:customers:getTransactions', (_, id) => database.getCustomerTransactions(id));

  // Suppliers & Procurement
  ipcMain.handle('db:suppliers:getAll', () => database.getSuppliers());
  ipcMain.handle('db:suppliers:create', (_, supplier) => database.createSupplier(supplier));
  ipcMain.handle('db:suppliers:update', (_, supplier) => database.updateSupplier(supplier));
  ipcMain.handle('db:suppliers:delete', (_, id) => database.deleteSupplier(id));

  // Parked / Held Orders
  ipcMain.handle('db:heldOrders:getAll', () => database.getHeldOrders());
  ipcMain.handle('db:heldOrders:save', (_, order) => database.saveHeldOrder(order));
  ipcMain.handle('db:heldOrders:delete', (_, id) => database.deleteHeldOrder(id));

  // Thermal Printer Handlers
  ipcMain.handle('printer:getList', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return [];
      return await win.webContents.getPrintersAsync();
    } catch (err) {
      console.error('Failed to get printers:', err);
      return [];
    }
  });

  ipcMain.handle('printer:printThermal', async (event, { html, options = {} }) => {
    return new Promise((resolve) => {
      try {
        const {
          deviceName = '',
          silent = false,
          paperWidth = '80mm',
          feedLines = 3,
        } = options;

        const is58 = paperWidth === '58mm';
        const winWidth = is58 ? 240 : 340;
        const bodyWidth = is58 ? '48mm' : '72mm';
        const fontSize = is58 ? '10px' : '11px';
        const titleSize = is58 ? '13px' : '15px';
        const feedHeight = Math.max(1, parseInt(feedLines, 10) || 3) * 4;

        const printWin = new BrowserWindow({
          show: false,
          width: winWidth,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        const fullHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Thermal Bill</title>
              <style>
                @page {
                  size: ${is58 ? '58mm' : '80mm'} auto;
                  margin: 0;
                }
                * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
                }
                body {
                  font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
                  font-size: ${fontSize};
                  line-height: 1.3;
                  color: #000;
                  background: #fff;
                  width: ${bodyWidth};
                  padding: 2mm 1mm;
                  margin: 0 auto;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .bold { font-weight: bold; }
                .store-title { font-size: ${titleSize}; font-weight: bold; text-align: center; margin-bottom: 2px; }
                .subtext { font-size: 9px; text-align: center; color: #222; margin: 1px 0; }
                .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
                .double-divider { border-bottom: 2px solid #000; margin: 5px 0; }
                .row { display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0; }
                .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
                .items-table th { border-bottom: 1px solid #000; padding: 2px 0; font-size: 9px; text-transform: uppercase; }
                .items-table td { padding: 3px 0; vertical-align: top; }
                .item-name { font-weight: bold; font-size: 10.5px; }
                .item-details { display: flex; justify-content: space-between; font-size: 10px; }
                .totals-row { display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0; }
                .grand-total { font-size: 13px; font-weight: bold; padding: 4px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 4px 0; }
                .barcode-wrap { text-align: center; margin: 8px 0; }
                .footer-text { text-align: center; font-size: 9px; margin-top: 6px; }
                .feed { height: ${feedHeight}mm; }
              </style>
            </head>
            <body>
              ${html}
              <div class="feed"></div>
            </body>
          </html>
        `;

        printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

        printWin.webContents.on('did-finish-load', () => {
          const printOptions = {
            silent: Boolean(silent),
            printBackground: true,
            margins: { marginType: 'none' },
            color: false,
          };
          if (deviceName) {
            printOptions.deviceName = deviceName;
          }

          printWin.webContents.print(printOptions, (success, failureReason) => {
            printWin.close();
            resolve({ success, failureReason });
          });
        });

        printWin.webContents.on('did-fail-load', (_, __, errorDescription) => {
          printWin.close();
          resolve({ success: false, failureReason: errorDescription });
        });
      } catch (err) {
        resolve({ success: false, failureReason: err.message });
      }
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 820,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    show: false,
  });

  const distIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    win.loadFile(distIndex);
  } else {
    win.loadFile('index.html');
  }

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools();
  });
}

app.whenReady().then(() => {
  try {
    const databasePath = path.join(app.getPath('userData'), 'mini-pos.sqlite');
    const legacyDataPath = path.join(app.getPath('userData'), 'pos-data', 'data.json');
    database = new PosDatabase(databasePath, legacyDataPath);
    registerDatabaseHandlers();
    createWindow();
  } catch (error) {
    console.error('Failed to initialize the POS database:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => {
  database?.close();
});
