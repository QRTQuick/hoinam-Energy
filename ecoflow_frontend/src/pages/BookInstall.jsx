import React, { useState } from 'react';

import api from '../api/axios';
import InstallForm from '../components/InstallForm';
import { useAuth } from '../context/AuthContext';

export default function BookInstall() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (payload) => {
    setLoading(true);
    setMessage('');
    try {
      await api.post('/installations', payload);
      setMessage('Installation request submitted. Our team will reach out shortly.');
    } catch (error) {
      setMessage('Unable to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-slate-600">Please sign in to book an installation.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold text-deepForest">Book installation</h1>
      <p className="mt-2 text-sm text-slate-600">
        Tell us about your site and preferred dates. We will confirm availability.
      </p>
      <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <InstallForm onSubmit={handleSubmit} loading={loading} />
        {message && <p className="mt-4 text-sm text-sunOrange">{message}</p>}
      </div>
    </div>
  );
}
