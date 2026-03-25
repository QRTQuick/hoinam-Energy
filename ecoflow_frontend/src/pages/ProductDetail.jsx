import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import api from '../api/axios';
import { useCart } from '../context/CartContext';

export default function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    api.get(`/products/${id}`).then((res) => setProduct(res.data)).catch(() => {});
  }, [id]);

  if (!product) {
    return <div className="mx-auto w-full max-w-4xl px-6 py-12">Loading...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link to="/products" className="text-sm text-sunOrange hover:underline">
        Back to products
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[32px] bg-hero-sunrise p-8">
          <p className="badge-sun">EcoFlow</p>
          <h1 className="mt-4 font-heading text-3xl font-semibold text-deepForest">
            {product.name}
          </h1>
          <p className="mt-4 text-slate-700">
            {product.description || 'High-performance solar generator built for clean power independence.'}
          </p>
        </div>
        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase text-slate-400">Price</p>
          <p className="text-3xl font-semibold text-ecoGreen">₦ {product.price || 0}</p>
          <p className="mt-2 text-sm text-slate-500">Available quantity: {product.quantity}</p>
          <button className="btn-primary mt-6 w-full" onClick={() => addItem(product)}>
            Add to cart
          </button>
          <div className="mt-6 space-y-2 text-sm text-slate-600">
            <p>Free consultation and site review with every purchase.</p>
            <p>Includes installation booking for qualified projects.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
