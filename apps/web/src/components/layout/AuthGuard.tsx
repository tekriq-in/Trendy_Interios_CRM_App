'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

function requiresPasswordChange(token: string): boolean {
  try {
    const encoded = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!encoded) return false;
    const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
    const payload = JSON.parse(atob(padded)) as { mustChangePassword?: boolean };
    return payload.mustChangePassword === true;
  } catch {
    return false;
  }
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { _hasHydrated, refreshToken, accessToken, setAuth, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;

    // Already have an in-memory access token — good to go.
    if (accessToken) {
      if (requiresPasswordChange(accessToken)) {
        router.replace('/change-password');
        return;
      }
      setReady(true);
      return;
    }

    // No refresh token persisted → send to login.
    if (!refreshToken) { router.replace('/login'); return; }

    // Have a refresh token but no access token (e.g. after a hard reload).
    // Silently exchange it before showing the dashboard.
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    axios
      .post<{ accessToken: string; refreshToken: string }>(
        `${baseUrl}/auth/refresh`,
        { refreshToken },
      )
      .then(({ data }) => {
        setAuth(data.accessToken, data.refreshToken);
        if (requiresPasswordChange(data.accessToken)) {
          router.replace('/change-password');
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        clearAuth();
        router.replace('/login');
      });
  }, [_hasHydrated, accessToken, refreshToken, setAuth, clearAuth, router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f7fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm animate-pulse">
            TI
          </div>
          <p className="text-xs text-slate-400 tracking-wide">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
