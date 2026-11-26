'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { _hasHydrated, accessToken, refreshToken, setAuth } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;

    if (accessToken) {
      setReady(true);
      return;
    }

    if (!refreshToken) {
      router.replace('/login');
      return;
    }

    axios
      .post<{ accessToken: string; refreshToken: string }>(`${API_URL}/auth/refresh`, { refreshToken })
      .then(({ data }) => {
        setAuth(data.accessToken, data.refreshToken);
        setReady(true);
      })
      .catch(() => router.replace('/login'));
  }, [_hasHydrated, accessToken, refreshToken, setAuth, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (!PASSWORD_POLICY.test(newPassword)) {
      setError('New password must be 8–128 characters and include an uppercase letter, a lowercase letter, and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current password.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await apiClient.post<{ accessToken: string; refreshToken: string }>(
        '/auth/change-password',
        { currentPassword, newPassword, confirmPassword },
      );
      setAuth(data.accessToken, data.refreshToken);
      router.replace('/dashboard');
    } catch (e: unknown) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(', ') : (raw ?? 'Password change failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Verifying your session…</div>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Change your password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your current password and choose a new password to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-slate-700">Current password</label>
            <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} maxLength={128} required />
            <p className="mt-1 text-xs text-slate-500">8–128 characters, including uppercase, lowercase, and a number.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} maxLength={128} required />
          </div>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Updating password…' : 'Set new password'}
          </button>
        </form>
      </section>
    </main>
  );
}
