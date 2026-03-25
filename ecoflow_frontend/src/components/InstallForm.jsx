import React, { useState } from 'react';

export default function InstallForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    address: '',
    preferred_date: '',
    notes: '',
  });

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-slate-700">Installation address</label>
        <textarea
          name="address"
          value={form.address}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border border-slate-200 p-3"
          rows={3}
          placeholder="Enter the exact installation address"
          required
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Preferred date</label>
        <input
          type="date"
          name="preferred_date"
          value={form.preferred_date}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border border-slate-200 p-3"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border border-slate-200 p-3"
          rows={4}
          placeholder="Any special instructions or site notes"
        />
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Submitting...' : 'Book Installation'}
      </button>
    </form>
  );
}
