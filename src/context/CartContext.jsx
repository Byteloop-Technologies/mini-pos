import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useSettings } from './SettingsContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { settings } = useSettings();
  const [items, setItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discount, setDiscount] = useState(0);
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

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscount(0);
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
  }, []);

  const cartCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const taxRate = useMemo(() => {
    const rate = Number(settings.tax_rate);
    return Number.isFinite(rate) ? rate : 8;
  }, [settings.tax_rate]);

  const discountedSubtotal = useMemo(() => {
    return Math.max(0, subtotal - Number(discount || 0));
  }, [subtotal, discount]);

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
        clearCart,
        loadHeldOrder,
        cartCount,
        subtotal,
        discountedSubtotal,
        discount,
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
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
