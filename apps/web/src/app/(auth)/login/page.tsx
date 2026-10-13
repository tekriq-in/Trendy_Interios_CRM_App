'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post<{
        requiresMfa?: boolean;
        userId?: string;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/login', { email, password });

      if (res.data.requiresMfa) {
        setMfaRequired(true);
        setUserId(res.data.userId!);
      } else {
        // Decode JWT payload to extract name/email/role for UI display
        const payload = JSON.parse(atob(res.data.accessToken!.split('.')[1]));
        const name: string = payload.name ?? email.split('@')[0];
        const roleName: string = payload.role ?? 'Staff';
        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        setAuth(res.data.accessToken!, res.data.refreshToken!, {
          name, email, role: roleName, initials,
        });
        router.push('/dashboard');
      }
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post<{ accessToken: string; refreshToken: string }>(
        '/auth/mfa/verify',
        { userId, token: mfaToken },
      );
      const payload = JSON.parse(atob(res.data.accessToken.split('.')[1]));
      const name: string = payload.name ?? email.split('@')[0];
      const roleName: string = payload.role ?? 'Staff';
      const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      setAuth(res.data.accessToken, res.data.refreshToken, { name, email, role: roleName, initials });
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
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@trendyinteriors.in"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputCls}
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
