import React from 'react';

export default function CartItem({ item, onRemove, onUpdate }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-heading text-base font-semibold text-deepForest">{item.name}</p>
        <p className="text-sm text-slate-500">₦ {item.price || 0}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="h-8 w-8 rounded-full border border-ecoLightGreen text-ecoGreen"
          onClick={() => onUpdate(item.id, item.qty - 1)}
        >
          -
        </button>
        <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
        <button
          className="h-8 w-8 rounded-full border border-ecoLightGreen text-ecoGreen"
          onClick={() => onUpdate(item.id, item.qty + 1)}
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold">₦ {(item.price || 0) * item.qty}</p>
        <button className="text-xs text-red-500" onClick={() => onRemove(item.id)}>
          Remove
        </button>
      </div>
    </div>
  );
}
