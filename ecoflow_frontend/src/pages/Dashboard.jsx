import React, { useEffect, useState } from 'react';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [installations, setInstallations] = useState([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    api.get('/orders/mine').then((res) => setOrders(res.data)).catch(() => {});
    api.get('/installations/mine').then((res) => setInstallations(res.data)).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <p className="text-slate-600">Sign in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold text-deepForest">Welcome back, {user.name}</h1>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold">Orders</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No orders yet.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {orders.map((order) => (
                <li key={order.id} className="rounded-2xl border border-slate-100 p-3">
                  <p className="font-semibold">Order #{order.id}</p>
                  <p className="text-slate-500">Total: ₦ {order.total_amount}</p>
                  <p className="text-slate-500">Status: {order.status}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold">Installations</h2>
          {installations.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No installation bookings yet.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {installations.map((inst) => (
                <li key={inst.id} className="rounded-2xl border border-slate-100 p-3">
                  <p className="font-semibold">Request #{inst.id}</p>
                  <p className="text-slate-500">Date: {inst.preferred_date || 'Pending'}</p>
                  <p className="text-slate-500">Status: {inst.status}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
