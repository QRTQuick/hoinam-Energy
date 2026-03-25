import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';

import logo from '../assets/hoinam-logo.svg';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const links = [
    { to: '/', label: 'Home' },
    { to: '/products', label: 'Products' },
    { to: '/book-install', label: 'Book Installation' },
    ...(user ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
  ];

  return (
    <header className="bg-deepForest text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Hoinam Energy" className="h-10 w-10" />
          <div>
            <p className="font-heading text-lg font-semibold">Hoinam Energy</p>
            <p className="text-xs text-ecoLightGreen">EcoFlow Solar Solutions</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `transition hover:text-sunLightOrange ${
                  isActive ? 'text-sunLightOrange' : 'text-white'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link to="/cart" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {items.length > 0 && (
              <span className="absolute -right-2 -top-2 rounded-full bg-sunOrange px-1 text-[10px] font-semibold">
                {items.length}
              </span>
            )}
          </Link>
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden sm:inline">Hi {user.name?.split(' ')[0]}</span>
              <button onClick={logout} className="btn-outline text-xs">
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-xs">
              Sign In
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-6 border-t border-white/10 bg-deepForest/95 px-6 py-2 text-xs text-sunLightOrange md:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'font-semibold' : '')}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
}
