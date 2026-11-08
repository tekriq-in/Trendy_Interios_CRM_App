'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Detect whether the identifier looks like a phone number
  const isPhoneInput = /^[+\d][\d\s\-()+]*$/.test(identifier.trim()) && !identifier.includes('@');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) {
      setError('Enter your email or phone number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post<{
        requiresMfa?: boolean;
        userId?: string;
        accessToken?: string;
        refreshToken?: string;
      }>(`${API_URL}/auth/login`, { identifier: id, password });

      if (res.data.requiresMfa) {
        setMfaRequired(true);
        setUserId(res.data.userId!);
      } else {
        const payload = JSON.parse(atob(res.data.accessToken!.split('.')[1]));
        const name: string = payload.name ?? id.split('@')[0];
        const roleName: string = payload.role ?? 'Staff';
        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        setAuth(res.data.accessToken!, res.data.refreshToken!, {
          id: payload.sub as string,
          name, email: payload.email ?? id, role: roleName, initials,
          department: payload.department ?? null,
        });
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string }; status?: number }; message?: string; code?: string };
      const status = axiosErr?.response?.status;
      const msg = axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Unknown error';
      if (status === 401) {
        setError('Invalid credentials. Check your email/phone and password.');
      } else if (!status) {
        setError(`Cannot reach API at ${API_URL} — make sure the backend is running on port 3001. (${axiosErr?.code ?? axiosErr?.message})`);
      } else {
        setError(`Error ${status}: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_URL}/auth/mfa/verify`,
        { userId, token: mfaToken },
      );
      const payload = JSON.parse(atob(res.data.accessToken.split('.')[1]));
      const name: string = payload.name ?? identifier.split('@')[0];
      const roleName: string = payload.role ?? 'Staff';
      const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      setAuth(res.data.accessToken, res.data.refreshToken, { id: payload.sub as string, name, email: payload.email ?? identifier, role: roleName, initials, department: payload.department ?? null });
      router.push('/dashboard');
    } catch {
      setError('Invalid MFA code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow';

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex-col items-center justify-center p-12 text-white">
        <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl font-bold mb-8 shadow-2xl">
          TI
        </div>
        <h1 className="text-4xl font-bold mb-3 tracking-tight">Trendy Interios</h1>
        <p className="text-slate-300 text-center text-lg max-w-sm leading-relaxed">
          End-to-end project tracking for interior manufacturing
        </p>
        <div className="mt-14 grid grid-cols-2 gap-4 w-full max-w-xs">
          {[
            { value: '8', label: 'Departments' },
            { value: '4', label: 'Role levels' },
            { value: '100%', label: 'Traceable' },
            { value: 'Live', label: 'Real-time sync' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <p className="text-white font-bold text-2xl">{stat.value}</p>
              <p className="text-slate-400 text-sm mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              TI
            </div>
            <span className="font-semibold text-slate-900">Trendy Interios</span>
          </div>

          {!mfaRequired ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isPhoneInput ? 'Phone number' : 'Email or phone number'}
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Email address or phone number"
                    autoComplete="username"
                    required
                    className={inputCls}
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    {isPhoneInput
                      ? 'Signing in with phone number'
                      : 'MD and GM sign in with email · all others use phone number'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-700 break-words">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm mt-2"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Two-factor auth</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <form onSubmit={handleMfa} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Verification code
                  </label>
                  <input
                    type="text"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value)}
                    maxLength={6}
                    placeholder="000000"
                    required
                    className={`${inputCls} text-center tracking-[0.4em] text-lg font-mono`}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loading ? 'Verifying…' : 'Verify'}
                </button>

                <button
                  type="button"
                  onClick={() => { setMfaRequired(false); setError(''); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-1"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
