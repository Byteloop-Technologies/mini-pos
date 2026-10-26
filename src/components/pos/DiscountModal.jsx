import React, { useState, useMemo } from 'react';
import { useCart } from '../../context/CartContext';
import { useSettings } from '../../context/SettingsContext';

export default function DiscountModal({ onClose, targetItem = null }) {
  const { settings, formatCurrency } = useSettings();
  const {
    subtotal,
    discountState,
    applyDiscount,
    removeDiscount,
    setItemDiscount,
    removeItemDiscount,
  } = useCart();

  // If targetItem is set, we are applying line-item discount; otherwise cart-level discount
  const isLineItem = Boolean(targetItem);
  const targetSubtotal = isLineItem ? targetItem.price * targetItem.quantity : subtotal;

  const currentType = isLineItem
    ? (targetItem.discountType || 'percentage')
    : (discountState.type || 'percentage');
  const currentValue = isLineItem
    ? (targetItem.discountValue || '')
    : (discountState.value ? String(discountState.value) : '');
  const currentReason = isLineItem
    ? (targetItem.discountReason || '')
    : (discountState.reason || '');

  const [type, setType] = useState(currentType);
  const [value, setValue] = useState(currentValue);
  const [reason, setReason] = useState(currentReason || 'Customer Discount');
  const [promoCode, setPromoCode] = useState(discountState.code || '');
  const [promoMessage, setPromoMessage] = useState('');

  // Parse presets from settings or default
  const configuredPresets = useMemo(() => {
    try {
      if (settings.discount_presets) {
        const parsed = JSON.parse(settings.discount_presets);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [
      { name: 'Member Discount', type: 'percentage', value: 5, code: 'MEMBER5' },
      { name: 'Seasonal Sale', type: 'percentage', value: 10, code: 'SAVE10' },
      { name: 'Staff Discount', type: 'percentage', value: 15, code: 'STAFF15' },
      { name: 'Clearance', type: 'percentage', value: 20, code: 'CLEAR20' },
      { name: 'Voucher $5 Off', type: 'fixed', value: 5, code: 'VOUCHER5' },
    ];
  }, [settings.discount_presets]);

  const maxAllowedPercent = Number(settings.max_discount_percent || 50);

  // Calculate live preview
  const numVal = parseFloat(value) || 0;
  let calculatedDeduction = 0;
  if (type === 'percentage') {
    calculatedDeduction = Math.round(targetSubtotal * (Math.min(100, numVal) / 100) * 100) / 100;
  } else {
    calculatedDeduction = Math.min(targetSubtotal, numVal);
  }
  const projectedSubtotal = Math.max(0, targetSubtotal - calculatedDeduction);

  const isOverMax = type === 'percentage' && numVal > maxAllowedPercent;

  const handleApplyPreset = (preset) => {
    setType(preset.type);
    setValue(String(preset.value));
    setReason(preset.name);
    if (preset.code) setPromoCode(preset.code);
    setPromoMessage(`Preset applied: ${preset.name}`);
  };

  const handleApplyPromoCode = () => {
    const cleanCode = promoCode.trim().toUpperCase();
    if (!cleanCode) return;
    const match = configuredPresets.find((p) => p.code && p.code.toUpperCase() === cleanCode);
    if (match) {
      setType(match.type);
      setValue(String(match.value));
      setReason(match.name);
      setPromoMessage(`Promo code "${cleanCode}" valid: ${match.name}`);
    } else {
      setPromoMessage(`Promo code "${cleanCode}" not found`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (numVal <= 0) {
      alert('Please enter a valid discount amount or percentage.');
      return;
    }
    if (isOverMax) {
      alert(`Discount exceeds store maximum policy limit of ${maxAllowedPercent}%.`);
      return;
    }

    if (isLineItem) {
      setItemDiscount(targetItem.productId, {
        type,
        value: numVal,
        reason: reason || `${numVal}${type === 'percentage' ? '%' : ''} Item Discount`,
      });
    } else {
      applyDiscount({
        type,
        value: numVal,
        reason: reason || `${numVal}${type === 'percentage' ? '%' : ''} Order Discount`,
        code: promoCode.trim().toUpperCase(),
      });
    }

    onClose();
  };

  const handleRemove = () => {
    if (isLineItem) {
      removeItemDiscount(targetItem.productId);
    } else {
      removeDiscount();
    }
    onClose();
  };

  const hasExistingDiscount = isLineItem
    ? Number(targetItem.discount || 0) > 0
    : Number(discountState.value || 0) > 0;

  return (
    <div className="modal-overlay active" role="dialog" aria-modal="true" aria-labelledby="discountModalTitle">
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 id="discountModalTitle">
              {isLineItem ? `Item Discount: ${targetItem.name}` : 'Order Discount & Promo'}
            </h3>
            <span className="stock-badge info">
              Base: {formatCurrency(targetSubtotal)}
            </span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Real-time Impact Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                padding: '12px',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Subtotal
                </span>
                <strong style={{ fontFamily: 'var(--font-data)' }}>
                  {formatCurrency(targetSubtotal)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Deduction
                </span>
                <strong style={{ fontFamily: 'var(--font-data)', color: 'var(--success)' }}>
                  -{formatCurrency(calculatedDeduction)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>
                  Payable Subtotal
                </span>
                <strong style={{ fontFamily: 'var(--font-data)', color: 'var(--accent)' }}>
                  {formatCurrency(projectedSubtotal)}
                </strong>
              </div>
            </div>

            {/* Discount Type Toggle */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Discount Mode:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${type === 'percentage' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 12px', fontSize: '0.8125rem' }}
                  onClick={() => setType('percentage')}
                >
                  Percentage (%) Off
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${type === 'fixed' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 12px', fontSize: '0.8125rem' }}
                  onClick={() => setType('fixed')}
                >
                  Fixed Amount ({settings.currency_symbol || '$'}) Off
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Standard Presets:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {type === 'percentage' ? (
                  [5, 10, 15, 20, 25].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`btn btn-sm ${numVal === pct ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setValue(String(pct));
                        setReason(`${pct}% Promotional Discount`);
                      }}
                    >
                      {pct}%
                    </button>
                  ))
                ) : (
                  [1, 2, 5, 10, 20].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={`btn btn-sm ${numVal === amt ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setValue(String(amt));
                        setReason(`${formatCurrency(amt)} Fixed Voucher`);
                      }}
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Configured ERP Presets */}
            {!isLineItem && configuredPresets.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Store Promo Presets:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {configuredPresets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.6875rem' }}
                      onClick={() => handleApplyPreset(p)}
                    >
                      {p.name} ({p.type === 'percentage' ? `${p.value}%` : formatCurrency(p.value)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Promo Code Input */}
            {!isLineItem && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.75rem' }}>Promo / Coupon Code</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SAVE10, MEMBER5, STAFF15"
                    style={{ textTransform: 'uppercase' }}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleApplyPromoCode}
                  >
                    Apply Code
                  </button>
                </div>
                {promoMessage && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                    {promoMessage}
                  </span>
                )}
              </div>
            )}

            {/* Custom Value Input */}
            <div className="form-group">
              <label htmlFor="discountVal">
                {type === 'percentage' ? 'Discount Percentage (%) *' : `Discount Amount (${settings.currency_symbol || '$'}) *`}
              </label>
              <input
                id="discountVal"
                type="number"
                step={type === 'percentage' ? '1' : '0.01'}
                min="0.01"
                max={type === 'percentage' ? '100' : targetSubtotal}
                required
                className="form-control"
                placeholder={type === 'percentage' ? '10' : '5.00'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
              {isOverMax && (
                <span style={{ color: 'var(--danger)', fontSize: '0.6875rem', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                  Warning: Exceeds store maximum discount limit of {maxAllowedPercent}%.
                </span>
              )}
            </div>

            {/* Reason / Notes */}
            <div className="form-group">
              <label htmlFor="discountReason">Reason / Category</label>
              <input
                id="discountReason"
                type="text"
                className="form-control"
                placeholder="e.g. VIP Customer, Staff Discount, Clearance"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {hasExistingDiscount && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={handleRemove}
                >
                  Remove Discount
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={numVal <= 0 || isOverMax}
              >
                Apply {formatCurrency(calculatedDeduction)} Discount
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
