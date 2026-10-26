import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useSettings } from './SettingsContext';

const CartContext = createContext(null);

const INITIAL_DISCOUNT_STATE = {
  type: 'fixed', // 'percentage' | 'fixed'
  value: 0,
  amount: 0,
  reason: '',
  code: '',
};

export function CartProvider({ children }) {
  const { settings } = useSettings();
  const [items, setItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discountState, setDiscountState] = useState(INITIAL_DISCOUNT_STATE);
  const [notes, setNotes] = useState('');
  const [heldOrderId, setHeldOrderId] = useState(null);

  const addItem = useCallback((product, qty = 1) => {
    if (!product || product.stock <= 0) return false;
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);
      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].quantity;
        if (currentQty + qty > product.stock) {
          return prev; // stock limit reached
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: currentQty + qty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          cost_price: product.cost_price || 0,
          stock: product.stock,
          barcode: product.barcode,
          sku: product.sku,
          discount: 0,
          discountType: 'fixed',
          discountValue: 0,
          quantity: Math.min(qty, product.stock),
        },
      ];
    });
    return true;
  }, []);

  const updateQuantity = useCallback((productId, qty) => {
    setItems((prev) => {
      if (qty <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      return prev.map((item) => {
        if (item.productId === productId) {
          const maxAllowed = item.stock ?? 999999;
          return {
            ...item,
            quantity: Math.min(qty, maxAllowed),
          };
        }
        return item;
      });
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  // Per-item line discount
  const setItemDiscount = useCallback((productId, { type = 'percentage', value = 0, reason = '' } = {}) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const val = Math.max(0, Number(value) || 0);
        let deduction = 0;
        const lineGross = item.price * item.quantity;
        if (type === 'percentage') {
          deduction = Math.round(lineGross * (Math.min(100, val) / 100) * 100) / 100;
        } else {
          deduction = Math.min(lineGross, val);
        }
        return {
          ...item,
          discount: deduction,
          discountType: type,
          discountValue: val,
          discountReason: reason || null,
        };
      })
    );
  }, []);

  const removeItemDiscount = useCallback((productId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        return {
          ...item,
          discount: 0,
          discountType: 'fixed',
          discountValue: 0,
          discountReason: null,
        };
      })
    );
  }, []);

  // Apply Cart-level discount
  const applyDiscount = useCallback(({ type = 'percentage', value = 0, reason = '', code = '' } = {}) => {
    const val = Math.max(0, Number(value) || 0);
    setDiscountState({
      type,
      value: val,
      amount: 0, // calculated dynamically below
      reason: reason || (type === 'percentage' ? `${val}% Discount` : `$${val} Off`),
      code: code ? code.toUpperCase() : '',
    });
  }, []);

  const removeDiscount = useCallback(() => {
    setDiscountState(INITIAL_DISCOUNT_STATE);
  }, []);

  // Flexible setter for backward-compatibility with number or object
  const setDiscount = useCallback((val) => {
    if (typeof val === 'number') {
      applyDiscount({ type: 'fixed', value: val, reason: 'Custom Discount' });
    } else if (val && typeof val === 'object') {
      applyDiscount(val);
    } else {
      removeDiscount();
    }
  }, [applyDiscount, removeDiscount]);

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscountState(INITIAL_DISCOUNT_STATE);
    setNotes('');
    setSelectedCustomer(null);
    setHeldOrderId(null);
  }, []);

  const loadHeldOrder = useCallback((heldOrder) => {
    if (!heldOrder) return;
    setItems(heldOrder.items || []);
    setSelectedCustomer(heldOrder.customer_name ? { name: heldOrder.customer_name } : null);
    setNotes(heldOrder.notes || '');
    setHeldOrderId(heldOrder.id);
    if (heldOrder.discount && Number(heldOrder.discount) > 0) {
      setDiscountState({
        type: heldOrder.discount_type || heldOrder.discountType || 'fixed',
        value: Number(heldOrder.discount_rate || heldOrder.discountRate || heldOrder.discount),
        amount: Number(heldOrder.discount),
        reason: heldOrder.discount_reason || heldOrder.discountReason || 'Held Order Discount',
        code: '',
      });
    } else {
      setDiscountState(INITIAL_DISCOUNT_STATE);
    }
  }, []);

  const cartCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  // Raw gross sum before line item discounts
  const rawSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  // Sum of all line item discounts
  const itemDiscountsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  }, [items]);

  // Subtotal after line item discounts, before cart-level discount
  const subtotal = useMemo(() => {
    return Math.max(0, rawSubtotal - itemDiscountsTotal);
  }, [rawSubtotal, itemDiscountsTotal]);

  // Calculate actual cart-level discount deduction
  const cartDiscountAmount = useMemo(() => {
    if (!discountState.value || discountState.value <= 0) return 0;
    if (discountState.type === 'percentage') {
      const pct = Math.min(100, Math.max(0, discountState.value));
      return Math.round(subtotal * (pct / 100) * 100) / 100;
    }
    return Math.min(subtotal, Math.max(0, discountState.value));
  }, [subtotal, discountState]);

  // Total discounts combined (item discounts + cart discount)
  const totalDiscount = useMemo(() => {
    return Math.round((itemDiscountsTotal + cartDiscountAmount) * 100) / 100;
  }, [itemDiscountsTotal, cartDiscountAmount]);

  // Backwards-compatible discount number
  const discount = cartDiscountAmount;

  const taxRate = useMemo(() => {
    const rate = Number(settings.tax_rate);
    return Number.isFinite(rate) ? rate : 8;
  }, [settings.tax_rate]);

  const discountedSubtotal = useMemo(() => {
    return Math.max(0, subtotal - cartDiscountAmount);
  }, [subtotal, cartDiscountAmount]);

  const taxAmount = useMemo(() => {
    return Math.round(discountedSubtotal * (taxRate / 100) * 100) / 100;
  }, [discountedSubtotal, taxRate]);

  const total = useMemo(() => {
    return Math.round((discountedSubtotal + taxAmount) * 100) / 100;
  }, [discountedSubtotal, taxAmount]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        setItemDiscount,
        removeItemDiscount,
        clearCart,
        loadHeldOrder,
        cartCount,
        rawSubtotal,
        itemDiscountsTotal,
        subtotal,
        discountedSubtotal,
        discount,
        cartDiscountAmount,
        totalDiscount,
        discountState: {
          ...discountState,
          amount: cartDiscountAmount,
        },
        applyDiscount,
        removeDiscount,
        setDiscount,
        taxRate,
        taxAmount,
        total,
        selectedCustomer,
        setSelectedCustomer,
        notes,
        setNotes,
        heldOrderId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
