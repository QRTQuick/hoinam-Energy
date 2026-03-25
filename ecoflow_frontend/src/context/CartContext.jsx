import React, { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

const initial = () => {
  const stored = localStorage.getItem('hoinam_cart');
  return stored ? JSON.parse(stored) : [];
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(initial);

  const sync = (next) => {
    setItems(next);
    localStorage.setItem('hoinam_cart', JSON.stringify(next));
  };

  const addItem = (product) => {
    const existing = items.find((item) => item.id === product.id);
    if (existing) {
      sync(items.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item)));
      return;
    }
    sync([...items, { ...product, qty: 1 }]);
  };

  const removeItem = (id) => {
    sync(items.filter((item) => item.id !== id));
  };

  const updateQty = (id, qty) => {
    sync(items.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item)));
  };

  const clear = () => sync([]);

  const total = items.reduce((sum, item) => sum + item.qty * (item.price || 0), 0);

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQty, clear, total }),
    [items, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
