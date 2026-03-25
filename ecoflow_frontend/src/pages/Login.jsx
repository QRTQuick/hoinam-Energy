import React, { useState } from 'react';

import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('email');
  const [authMode, setAuthMode] = useState('signin');
  const [form, setForm] = useState({ email: '', password: '', phone: '', name: '', username: '' });
  const [otpStep, setOtpStep] = useState('request');
  const [otpCode, setOtpCode] = useState('');
  const [googleToken, setGoogleToken] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleEmailLogin = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const response = await api.post('/auth/login', {
        identifier: form.email,
        password: form.password,
      });
      login(response.data);
    } catch (error) {
      const apiMessage = error?.response?.data?.error;
      setMessage(apiMessage || 'Login failed. Check your email/username and password.');
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const response = await api.post('/auth/register', {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      login(response.data);
    } catch (error) {
      const apiMessage = error?.response?.data?.error;
      setMessage(apiMessage || 'Registration failed. Check the details and try again.');
    }
  };

  const handleOtpRequest = async () => {
    setMessage('');
    try {
      const response = await api.post('/auth/otp/request', { phone: form.phone });
      if (response.data.debug_otp) {
        setMessage(`Debug OTP: ${response.data.debug_otp}`);
      } else {
        setMessage('OTP sent to your phone.');
      }
      setOtpStep('verify');
    } catch (error) {
      const apiMessage = error?.response?.data?.error;
      setMessage(apiMessage || 'Unable to send OTP.');
    }
  };

  const handleOtpVerify = async () => {
    setMessage('');
    try {
      const response = await api.post('/auth/otp/verify', {
        phone: form.phone,
        code: otpCode,
        name: form.name,
        username: form.username,
      });
      login(response.data);
    } catch (error) {
      const apiMessage = error?.response?.data?.error;
      setMessage(apiMessage || 'OTP verification failed.');
    }
  };

  const handleGoogleLogin = async () => {
    setMessage('');
    try {
      const response = await api.post('/auth/google', { id_token: googleToken });
      login(response.data);
    } catch (error) {
      const apiMessage = error?.response?.data?.error;
      setMessage(apiMessage || 'Google login failed.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold text-deepForest">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        Access your dashboard, orders, and installation bookings.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          className={mode === 'email' ? 'btn-primary' : 'btn-outline'}
          onClick={() => setMode('email')}
        >
          Email login
        </button>
        <button
          className={mode === 'otp' ? 'btn-primary' : 'btn-outline'}
          onClick={() => setMode('otp')}
        >
          Phone OTP
        </button>
      </div>

      {message && <p className="mt-4 text-sm text-sunOrange">{message}</p>}

      {mode === 'email' && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-3">
            <button
              className={authMode === 'signin' ? 'btn-primary' : 'btn-outline'}
              onClick={() => setAuthMode('signin')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={authMode === 'register' ? 'btn-primary' : 'btn-outline'}
              onClick={() => setAuthMode('register')}
              type="button"
            >
              Register
            </button>
          </div>
          <form onSubmit={authMode === 'signin' ? handleEmailLogin : handleRegister} className="space-y-4">
            {authMode === 'register' && (
              <>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Full name"
                  className="w-full rounded-2xl border border-slate-200 p-3"
                />
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Username"
                  className="w-full rounded-2xl border border-slate-200 p-3"
                />
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  className="w-full rounded-2xl border border-slate-200 p-3"
                />
              </>
            )}
            <input
              name="email"
              type="text"
              value={form.email}
              onChange={handleChange}
              placeholder="Email or username"
              className="w-full rounded-2xl border border-slate-200 p-3"
            />
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Password"
              className="w-full rounded-2xl border border-slate-200 p-3"
            />
            <button className="btn-primary w-full">
              {authMode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      )}

      {mode === 'otp' && (
        <div className="mt-6 space-y-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full name"
            className="w-full rounded-2xl border border-slate-200 p-3"
          />
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Username"
            className="w-full rounded-2xl border border-slate-200 p-3"
          />
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Phone number"
            className="w-full rounded-2xl border border-slate-200 p-3"
          />
          {otpStep === 'verify' && (
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="Enter OTP"
              className="w-full rounded-2xl border border-slate-200 p-3"
            />
          )}
          <button
            className="btn-primary w-full"
            onClick={otpStep === 'request' ? handleOtpRequest : handleOtpVerify}
          >
            {otpStep === 'request' ? 'Send OTP' : 'Verify OTP'}
          </button>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-semibold">Google sign-in (admin configured)</p>
        <p className="mt-1 text-xs text-slate-500">
          Paste a Google ID token from your frontend integration.
        </p>
        <input
          value={googleToken}
          onChange={(event) => setGoogleToken(event.target.value)}
          placeholder="Google ID token"
          className="mt-3 w-full rounded-2xl border border-slate-200 p-3 text-xs"
        />
        <button className="btn-outline mt-3 w-full" onClick={handleGoogleLogin}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
