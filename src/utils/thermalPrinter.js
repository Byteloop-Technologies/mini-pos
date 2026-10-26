import { api } from '../api';

/**
 * Format currency according to system settings
 */
export function formatCurrencyValue(amount, settings = {}) {
  const num = Number(amount);
  const validNum = Number.isFinite(num) ? num : 0;
  const decimals = parseInt(settings.currency_decimals ?? '2', 10);
  const symbol = settings.currency_symbol || '$';
  const position = settings.currency_position || 'prefix';

  const formatted = validNum.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return position === 'suffix' ? `${formatted} ${symbol}`.trim() : `${symbol}${formatted}`;
}

/**
 * Generates an authentic SVG 1D Barcode for the thermal receipt
 */
export function generateBarcodeSvg(code = 'BILL-0001') {
  const cleanCode = String(code).replace(/[^A-Za-z0-9_-]/g, '').toUpperCase() || 'BILL-0001';
  // Deterministic bar widths pattern based on string characters
  const bars = [];
  let x = 10;
  for (let i = 0; i < cleanCode.length; i++) {
    const charCode = cleanCode.charCodeAt(i);
    const pattern = [
      (charCode % 3) + 1,
      ((charCode >> 1) % 2) + 1,
      ((charCode >> 2) % 3) + 1,
      1,
    ];
    for (let p = 0; p < pattern.length; p++) {
      const w = pattern[p];
      if (p % 2 === 0) {
        bars.push(`<rect x="${x}" y="0" width="${w * 1.5}" height="28" fill="#000" />`);
      }
      x += w * 1.5 + 1;
    }
  }

  return `
    <div class="barcode-wrap">
      <svg width="${x + 20}" height="28" viewBox="0 0 ${x + 20} 28" style="display: block; margin: 0 auto;">
        ${bars.join('')}
      </svg>
      <div style="font-family: monospace; font-size: 9px; letter-spacing: 2px; text-align: center; margin-top: 2px;">
        * ${cleanCode} *
      </div>
    </div>
  `;
}

/**
 * Generates thermal-optimized HTML string for ESC/POS roll printing (80mm / 58mm)
 */
export function generateThermalReceiptHtml(saleOrCart, settings = {}) {
  const isDraft = Boolean(saleOrCart.isDraft);
  const billId = saleOrCart.id ? (isDraft ? `DRAFT-${saleOrCart.id}` : `INV-${saleOrCart.id}`) : `BILL-${Date.now().toString().slice(-6)}`;
  const dateStr = saleOrCart.created_at ? new Date(saleOrCart.created_at).toLocaleString() : new Date().toLocaleString();
  const is58 = settings.thermal_paper_width === '58mm';

  const subtotal = saleOrCart.subtotal ?? (saleOrCart.total ? saleOrCart.total / 1.08 : 0);
  const tax = saleOrCart.tax ?? (saleOrCart.total ? saleOrCart.total - subtotal : 0);
  const total = saleOrCart.total ?? (subtotal + tax);
  const discount = Number(saleOrCart.discount || 0);

  const items = saleOrCart.items || [];
  const totalItemQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

  const itemsHtml = items.map((item) => {
    const name = item.productName || item.name || 'Item';
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const itemDiscount = Number(item.discount || 0);
    const lineTotal = Math.max(0, price * qty - itemDiscount);

    return `
      <div style="margin-bottom: 3px;">
        <div class="item-name">${name}</div>
        <div class="item-details">
          <span>  ${qty} x ${formatCurrencyValue(price, settings)}${itemDiscount > 0 ? ` (-${formatCurrencyValue(itemDiscount, settings)})` : ''}</span>
          <span class="bold">${formatCurrencyValue(lineTotal, settings)}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="store-title">${settings.store_name || 'MINI POS ERP'}</div>
    ${settings.store_address ? `<div class="subtext">${settings.store_address}</div>` : ''}
    ${settings.store_phone ? `<div class="subtext">Tel: ${settings.store_phone}</div>` : ''}
    ${settings.store_tax_id ? `<div class="subtext">Tax ID / VAT: ${settings.store_tax_id}</div>` : ''}

    <div class="divider"></div>

    <div class="text-center bold" style="font-size: ${is58 ? '10px' : '11px'}; margin: 2px 0;">
      ${saleOrCart.payment_method === 'credit'
        ? '*** STORE LOAN / CREDIT BILL ***'
        : isDraft
        ? '*** PROFORMA BILL / ORDER SLIP ***'
        : `*** ${settings.receipt_header || 'TAX INVOICE'} ***`}
    </div>

    <div class="row">
      <span>BILL NO: ${billId}</span>
      <span>${saleOrCart.payment_method === 'credit' ? 'STORE LOAN' : (saleOrCart.payment_method ? saleOrCart.payment_method.toUpperCase() : (isDraft ? 'PENDING' : 'PAID'))}</span>
    </div>
    <div class="row">
      <span>DATE: ${dateStr}</span>
      <span>POS: #01</span>
    </div>
    <div class="row">
      <span>CUSTOMER: ${saleOrCart.customer_name || 'Walk-in'}</span>
    </div>

    <div class="divider"></div>

    <div style="margin: 4px 0;">
      ${itemsHtml}
    </div>

    <div class="divider"></div>

    <div class="totals-row">
      <span>Subtotal:</span>
      <span>${formatCurrencyValue(subtotal, settings)}</span>
    </div>

    ${discount > 0 ? `
    <div class="totals-row">
      <span>${saleOrCart.discount_reason || saleOrCart.discountReason ? `Discount (${saleOrCart.discount_reason || saleOrCart.discountReason}):` : 'Discount:'}</span>
      <span>-${formatCurrencyValue(discount, settings)}</span>
    </div>
    ` : ''}

    <div class="totals-row">
      <span>${settings.tax_name || 'Tax'} (${settings.tax_rate || 8}%):</span>
      <span>${formatCurrencyValue(tax, settings)}</span>
    </div>

    <div class="grand-total row">
      <span>${saleOrCart.payment_method === 'credit' ? 'INVOICE LOAN TOTAL:' : 'TOTAL DUE:'}</span>
      <span>${formatCurrencyValue(total, settings)}</span>
    </div>

    ${saleOrCart.payment_method === 'credit' ? `
    <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000;">
      <div class="totals-row">
        <span>Previous Loan Debt:</span>
        <span>${formatCurrencyValue(saleOrCart.previous_debt || 0, settings)}</span>
      </div>
      <div class="totals-row bold">
        <span>New Total Loan Due:</span>
        <span>${formatCurrencyValue(saleOrCart.new_debt ?? ((saleOrCart.previous_debt || 0) + total), settings)}</span>
      </div>
      <div class="totals-row" style="font-size: 8px; color: #444;">
        <span>Payment Status:</span>
        <span>PAY LATER (ON CREDIT)</span>
      </div>
    </div>
    ` : ''}

    ${saleOrCart.cashReceived ? `
    <div class="totals-row">
      <span>Cash Tendered:</span>
      <span>${formatCurrencyValue(saleOrCart.cashReceived, settings)}</span>
    </div>
    <div class="totals-row bold">
      <span>Change Due:</span>
      <span>${formatCurrencyValue(saleOrCart.changeDue, settings)}</span>
    </div>
    ` : ''}

    <div class="row" style="margin-top: 4px; font-size: 9px; color: #444;">
      <span>ITEMS: ${items.length}</span>
      <span>TOTAL PIECES: ${totalItemQty}</span>
    </div>

    ${saleOrCart.payment_method === 'credit' ? `
    <div style="margin-top: 14px; padding-top: 6px; border-top: 1px dashed #000; text-align: center; font-size: 9px;">
      <div>I acknowledge receipt of items on store loan / credit.</div>
      <div style="margin-top: 18px; border-bottom: 1px solid #000; width: 85%; margin-left: auto; margin-right: auto;"></div>
      <div style="margin-top: 3px; font-weight: bold;">Customer Signature</div>
    </div>
    ` : ''}

    <div class="divider"></div>

    ${generateBarcodeSvg(billId)}

    <div class="footer-text">
      ${settings.receipt_footer || 'Thank you for your business. Retain receipt for returns.'}
    </div>
    <div class="subtext" style="margin-top: 4px; font-size: 8px;">
      Powered by Mini POS ERP Terminal
    </div>
  `;
}

/**
 * Triggers thermal billing print:
 * Directly via Electron IPC silent printer or standard print fallback
 */
export async function printThermalBill(saleOrCart, settings = {}) {
  try {
    const html = generateThermalReceiptHtml(saleOrCart, settings);
    const options = {
      deviceName: settings.thermal_printer_name || '',
      silent: settings.thermal_silent_print === 'true',
      paperWidth: settings.thermal_paper_width || '80mm',
      feedLines: Number(settings.thermal_feed_lines || 3),
    };

    const result = await api.printer.printThermal({ html, options });
    return result;
  } catch (err) {
    console.error('Print thermal bill error:', err);
    window.print();
    return { success: false, failureReason: err.message };
  }
}

/**
 * Generates thermal HTML for loan repayment receipt / voucher
 */
export function generateLoanPaymentReceiptHtml(paymentData, settings = {}) {
  const is58 = settings.thermal_paper_width === '58mm';
  const voucherId = paymentData.reference || `LOAN-PAY-${Date.now().toString().slice(-6)}`;
  const dateStr = paymentData.paidAt ? new Date(paymentData.paidAt).toLocaleString() : new Date().toLocaleString();
  const customerName = paymentData.customerName || 'Customer';
  const customerPhone = paymentData.customerPhone || '';
  const amountPaid = Number(paymentData.amountPaid || paymentData.amount || 0);
  const previousDebt = Number(paymentData.previousDebt || 0);
  const remainingDebt = Number(paymentData.remainingDebt ?? Math.max(0, previousDebt - amountPaid));
  const method = String(paymentData.paymentMethod || 'cash').toUpperCase();

  return `
    <div class="store-title">${settings.store_name || 'MINI POS ERP'}</div>
    ${settings.store_address ? `<div class="subtext">${settings.store_address}</div>` : ''}
    ${settings.store_phone ? `<div class="subtext">Tel: ${settings.store_phone}</div>` : ''}
    ${settings.store_tax_id ? `<div class="subtext">Tax ID / VAT: ${settings.store_tax_id}</div>` : ''}

    <div class="divider"></div>

    <div class="text-center bold" style="font-size: ${is58 ? '10px' : '11px'}; margin: 2px 0;">
      *** LOAN REPAYMENT RECEIPT ***
    </div>

    <div class="row">
      <span>VOUCHER NO:</span>
      <span>${voucherId}</span>
    </div>
    <div class="row">
      <span>DATE & TIME:</span>
      <span>${dateStr}</span>
    </div>
    <div class="row">
      <span>CUSTOMER:</span>
      <span class="bold">${customerName}</span>
    </div>
    ${customerPhone ? `
    <div class="row">
      <span>PHONE:</span>
      <span>${customerPhone}</span>
    </div>
    ` : ''}
    <div class="row">
      <span>PAID VIA:</span>
      <span class="bold">${method}</span>
    </div>

    <div class="divider"></div>

    <div class="totals-row">
      <span>Previous Loan Debt:</span>
      <span>${formatCurrencyValue(previousDebt, settings)}</span>
    </div>

    <div class="totals-row bold" style="font-size: ${is58 ? '11px' : '12px'}; color: #000; margin: 3px 0;">
      <span>AMOUNT REPAID:</span>
      <span>-${formatCurrencyValue(amountPaid, settings)}</span>
    </div>

    <div class="totals-row bold" style="border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px;">
      <span>REMAINING LOAN BALANCE:</span>
      <span>${formatCurrencyValue(remainingDebt, settings)}</span>
    </div>

    ${paymentData.notes ? `
    <div class="subtext" style="margin-top: 4px; text-align: left;">
      Note: ${paymentData.notes}
    </div>
    ` : ''}

    <div class="divider"></div>

    ${generateBarcodeSvg(voucherId)}

    <div style="margin-top: 16px; display: flex; justify-content: space-between; font-size: 8px;">
      <div style="text-align: center; width: 45%;">
        <div style="border-bottom: 1px solid #000; height: 18px;"></div>
        <div style="margin-top: 2px;">Cashier / Store Stamp</div>
      </div>
      <div style="text-align: center; width: 45%;">
        <div style="border-bottom: 1px solid #000; height: 18px;"></div>
        <div style="margin-top: 2px;">Customer Signature</div>
      </div>
    </div>

    <div class="footer-text" style="margin-top: 12px;">
      Official acknowledgment of customer loan debt payment.
    </div>
    <div class="subtext" style="margin-top: 4px; font-size: 8px;">
      Powered by Mini POS ERP Terminal
    </div>
  `;
}

/**
 * Print thermal loan payment voucher
 */
export async function printLoanPaymentReceipt(paymentData, settings = {}) {
  try {
    const html = generateLoanPaymentReceiptHtml(paymentData, settings);
    const options = {
      deviceName: settings.thermal_printer_name || '',
      silent: settings.thermal_silent_print === 'true',
      paperWidth: settings.thermal_paper_width || '80mm',
      feedLines: Number(settings.thermal_feed_lines || 3),
    };

    const result = await api.printer.printThermal({ html, options });
    return result;
  } catch (err) {
    console.error('Print loan receipt error:', err);
    window.print();
    return { success: false, failureReason: err.message };
  }
}
