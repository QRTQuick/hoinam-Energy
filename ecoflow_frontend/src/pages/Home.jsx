import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, PlugZap, ShieldCheck } from 'lucide-react';

import api from '../api/axios';
import ProductCard from '../components/ProductCard';

const features = [
  {
    icon: Sun,
    title: 'Solar-first kits',
    desc: 'EcoFlow solar generators and panels configured for Nigerian climates.'
  },
  {
    icon: PlugZap,
    title: 'Fast deployment',
    desc: 'We deliver and install in record time so you stay powered.'
  },
  {
    icon: ShieldCheck,
    title: 'Certified installers',
    desc: 'Professional installation and aftercare across our offices.'
  }
];

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div className="bg-hero-sunrise">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row">
        <div className="flex-1">
          <span className="badge-sun">EcoFlow Official Partner</span>
          <h1 className="mt-6 font-heading text-4xl font-bold text-deepForest md:text-5xl">
            Clean power for homes, offices, and institutions in Nigeria.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-700">
            Hoinam Energy brings premium EcoFlow solar systems with expert installation and
            ongoing support. Shop power stations, panels, and book your installation in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/products" className="btn-primary">
              Explore Products
            </Link>
            <Link to="/book-install" className="btn-outline">
              Book Installation
            </Link>
          </div>
        </div>
        <div className="flex-1">
          <div className="rounded-[32px] bg-white/80 p-8 shadow-glow backdrop-blur">
            <h3 className="font-heading text-xl font-semibold text-deepForest">
              What you get with Hoinam Energy
            </h3>
            <div className="mt-6 space-y-4">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-start gap-4">
                  <div className="rounded-2xl bg-ecoLightGreen/60 p-3 text-ecoGreen">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{feature.title}</p>
                    <p className="text-sm text-slate-600">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-semibold text-deepForest">Top picks</h2>
          <Link to="/products" className="text-sm text-sunOrange hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {products.length === 0 ? (
            <p className="text-sm text-slate-600">Loading products...</p>
          ) : (
            products.map((product) => <ProductCard key={product.id} product={product} />)
          )}
        </div>
      </section>
    </div>
  );
}
