const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const appDir = __dirname;
const electronPath = path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe');

async function snapshot(page, name) {
  await page.screenshot({ path: path.join(appDir, name), fullPage: false });
}

async function measure(page) {
  return page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: Math.round(element.scrollTop),
        overflowX: style.overflowX,
        overflowY: style.overflowY
      };
    };

    return {
      viewport: { width: innerWidth, height: innerHeight },
      body: box('body'),
      main: box('.main'),
      grid: box('.pos-grid'),
      catalog: box('.catalog-section .section-content'),
      productGrid: box('.product-grid'),
      cart: box('.cart-panel'),
      cartItems: box('.cart-items'),
      summary: box('.cart-summary'),
      payment: box('.payment-section'),
      checkout: box('#checkoutBtn'),
      productCards: document.querySelectorAll('.product-card').length,
      cartCount: document.querySelector('#cartCount')?.textContent,
      total: document.querySelector('#total')?.textContent
    };
  });
}

(async () => {
  const app = await electron.launch({ executablePath: electronPath, args: [appDir], timeout: 30000 });
  const report = {};

  try {
    const page = await app.firstWindow();
    await page.waitForSelector('#productGrid .product-card', { timeout: 15000 });

    await page.setViewportSize({ width: 1400, height: 900 });
    report.desktopEmpty = await measure(page);
    await snapshot(page, 'pos-ui.png');

    for (let i = 0; i < 7; i++) {
      const cards = page.locator('.product-card:not(.out-of-stock)');
      await cards.nth(i % await cards.count()).click();
    }
    report.desktopFull = await measure(page);
    report.desktopFullScroll = await page.evaluate(() => {
      const cartItems = document.querySelector('.cart-items');
      cartItems.scrollTop = cartItems.scrollHeight;
      return {
        scrollTop: Math.round(cartItems.scrollTop),
        maxScrollTop: cartItems.scrollHeight - cartItems.clientHeight,
        lastItemVisible: (() => {
          const item = cartItems.lastElementChild;
          const itemRect = item.getBoundingClientRect();
          const containerRect = cartItems.getBoundingClientRect();
          return itemRect.bottom <= containerRect.bottom + 1;
        })()
      };
    });
    await snapshot(page, 'pos-cart.png');

    await page.setViewportSize({ width: 950, height: 760 });
    report.compact = await measure(page);
    report.compactCatalogScroll = await page.evaluate(() => {
      const catalog = document.querySelector('.catalog-section .section-content');
      catalog.scrollTop = catalog.scrollHeight;
      const lastCard = document.querySelector('.product-card:last-child');
      const cardRect = lastCard.getBoundingClientRect();
      const catalogRect = catalog.getBoundingClientRect();
      return {
        scrollTop: Math.round(catalog.scrollTop),
        maxScrollTop: catalog.scrollHeight - catalog.clientHeight,
        lastCardVisible: cardRect.bottom <= catalogRect.bottom + 1
      };
    });
    await snapshot(page, 'pos-compact.png');

    await page.setViewportSize({ width: 950, height: 640 });
    report.shortDesktop = await measure(page);
    report.shortDesktopScroll = await page.evaluate(() => {
      const main = document.querySelector('.main');
      main.scrollTop = main.scrollHeight;
      const checkoutRect = document.querySelector('#checkoutBtn').getBoundingClientRect();
      return {
        scrollTop: Math.round(main.scrollTop),
        maxScrollTop: main.scrollHeight - main.clientHeight,
        checkoutVisibleAfterScroll: checkoutRect.top >= 0 && checkoutRect.bottom <= innerHeight
      };
    });
    await snapshot(page, 'pos-short.png');

    await page.setViewportSize({ width: 820, height: 640 });
    report.stacked = await measure(page);
    report.stackedScroll = await page.evaluate(() => {
      const main = document.querySelector('.main');
      main.scrollTop = main.scrollHeight;
      return {
        scrollTop: Math.round(main.scrollTop),
        maxScrollTop: main.scrollHeight - main.clientHeight,
        checkoutVisibleAfterScroll: (() => {
          const rect = document.querySelector('#checkoutBtn').getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= innerHeight;
        })()
      };
    });
    await snapshot(page, 'pos-stacked.png');

    await page.locator('[data-tab="products"]').click();
    await page.waitForSelector('#products-panel.active');
    await page.locator('#addProductBtn').click();
    await page.setViewportSize({ width: 820, height: 600 });
    report.modal = await page.evaluate(() => {
      const modal = document.querySelector('#productModal .modal').getBoundingClientRect();
      const body = document.querySelector('#productModal .modal-body');
      const footer = document.querySelector('#productModal .modal-footer').getBoundingClientRect();
      return {
        modal: { top: Math.round(modal.top), bottom: Math.round(modal.bottom), height: Math.round(modal.height) },
        body: { clientHeight: body.clientHeight, scrollHeight: body.scrollHeight, overflowY: getComputedStyle(body).overflowY },
        footer: { top: Math.round(footer.top), bottom: Math.round(footer.bottom) },
        viewportHeight: innerHeight
      };
    });
    await snapshot(page, 'pos-modal.png');
    await page.locator('#closeModal').click();

    await page.locator('[data-tab="dashboard"]').click();
    await page.waitForSelector('#dashboard-panel.active');
    report.dashboard = await page.evaluate(() => ({
      cards: document.querySelectorAll('.stat-card').length,
      mainClientHeight: document.querySelector('.main').clientHeight,
      mainScrollHeight: document.querySelector('.main').scrollHeight,
      chartClientHeight: document.querySelector('.chart-section').clientHeight
    }));
    await snapshot(page, 'pos-dashboard.png');

    const errors = [];
    for (const [name, result] of Object.entries(report)) {
      if (result?.checkout && !['stacked', 'shortDesktop'].includes(name) && result.checkout.bottom > result.viewport.height) errors.push(`${name}: checkout below viewport`);
      if (result?.cart && !['stacked', 'shortDesktop'].includes(name) && result.cart.bottom > result.viewport.height) errors.push(`${name}: cart below viewport`);
    }
    if (!report.desktopFullScroll.lastItemVisible || report.desktopFullScroll.scrollTop <= 0) errors.push('cart items did not scroll to the final item');
    if (!report.compactCatalogScroll.lastCardVisible || report.compactCatalogScroll.scrollTop <= 0) errors.push('catalog did not scroll to the final product');
    if (!report.shortDesktopScroll.checkoutVisibleAfterScroll || report.shortDesktopScroll.scrollTop <= 0) errors.push('short desktop layout did not scroll to checkout');
    if (!report.stackedScroll.checkoutVisibleAfterScroll || report.stackedScroll.scrollTop <= 0) errors.push('stacked layout did not scroll to checkout');
    if (report.modal.footer.bottom > report.modal.viewportHeight) errors.push('modal footer below viewport');
    report.errors = errors;

    fs.writeFileSync(path.join(appDir, 'verify-ui-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await app.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
