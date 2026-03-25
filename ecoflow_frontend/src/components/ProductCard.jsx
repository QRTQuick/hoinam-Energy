import React from 'react';
import { Link } from 'react-router-dom';

import { useCart } from '../context/CartContext';

export default function ProductCard({ product }) {
  const { addItem } = useCart();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-ecoLightGreen/40 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex h-44 items-center justify-center bg-hero-sunrise p-6">
        <div className="text-center">
          <p className="badge-sun">EcoFlow</p>
          <h3 className="mt-3 font-heading text-lg font-semibold text-deepForest">
            {product.name}
          </h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-sm text-slate-600">
          {product.description || 'Quiet, portable power designed for everyday resilience.'}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-400">Price</p>
            <p className="text-lg font-semibold text-ecoGreen">₦ {product.price || 0}</p>
          </div>
          <button onClick={() => addItem(product)} className="btn-primary text-xs">
            Add to Cart
          </button>
        </div>
        <Link to={`/products/${product.id}`} className="text-xs text-sunOrange hover:underline">
          View details
        </Link>
      </div>
    </div>
  );
}
