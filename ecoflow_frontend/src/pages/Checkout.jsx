import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, clear } = useCart();
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post('/orders', {
        items,
        total_amount: total,
        delivery_address: address,
      });
      clear();
      navigate('/dashboard');
    } catch (error) {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-slate-600">Please sign in before checking out.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold text-deepForest">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold">Delivery address</label>
            <textarea
              className="mt-2 w-full rounded-2xl border border-slate-200 p-3"
              rows={4}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </div>
          <button className="btn-primary" disabled={loading}>
            {loading ? 'Placing order...' : 'Place order'}
          </button>
        </form>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>{item.name}</span>
                <span>₦ {(item.price || 0) * item.qty}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-4 text-base font-semibold">
            Total: ₦ {total.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
