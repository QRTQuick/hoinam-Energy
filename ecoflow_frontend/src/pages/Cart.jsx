import React from 'react';
import { Link } from 'react-router-dom';

import CartItem from '../components/CartItem';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { items, removeItem, updateQty, total } = useCart();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold text-deepForest">Your cart</h1>
      <div className="mt-8 space-y-4">
        {items.length === 0 ? (
          <p className="text-slate-600">
            Your cart is empty. <Link to="/products" className="text-sunOrange">Browse products</Link>.
          </p>
        ) : (
          items.map((item) => (
            <CartItem
              key={item.id}
              item={item}
              onRemove={removeItem}
              onUpdate={updateQty}
            />
          ))
        )}
      </div>
      {items.length > 0 && (
        <div className="mt-8 flex flex-col items-end gap-4">
          <p className="text-lg font-semibold">Total: ₦ {total.toFixed(2)}</p>
          <Link to="/checkout" className="btn-primary">
            Proceed to checkout
          </Link>
        </div>
      )}
    </div>
  );
}
