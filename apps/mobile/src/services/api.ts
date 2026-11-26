import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import { store } from '../store';
import { clearAuth, setAuth } from '../store/slices/auth.slice';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Render's free plan can take ~30-60s to wake after idle, so allow for it
  // instead of failing the very first request of the day.
  timeout: 45000,
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** One refresh at a time: parallel 401s all wait for the same request. */
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = store.getState().auth.refreshToken;
  if (!refreshToken) return null;
  try {
    // Plain axios, not `api`, so this call cannot recurse into the interceptor.
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 20000 },
    );
    store.dispatch(setAuth({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken }));
    return res.data.accessToken;
  } catch {
    return null;
  }
}

function isAuthRoute(url: string | undefined): boolean {
  return !!url && /^\/?auth\/(login|mfa|refresh)/.test(url);
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as RetriableConfig | undefined;
    // An admin reset this user's password: the API refuses everything (403) until they change
    // it, so send them to the change-password screen instead of treating it as a failure.
    const data = err.response?.data as { message?: string } | undefined;
    if (err.response?.status === 403 && data?.message === 'auth.password_change_required') {
      router.replace('/change-password');
      return Promise.reject(err);
    }
    // Access tokens last 15 minutes. Without this, staff were signed out of
    // the app every 15 minutes even though their refresh token was still valid.
    if (err.response?.status === 401 && original && !original._retried && !isAuthRoute(original.url)) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken().finally(() => { refreshing = null; });
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      store.dispatch(clearAuth());
    }
    return Promise.reject(err);
  },
);

/** Turns a failed request into a short, human message for the UI. */
export function describeApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'offline';
    const data = err.response.data as { message?: string | string[] } | undefined;
    const msg = Array.isArray(data?.message) ? data?.message[0] : data?.message;
    if (msg && !msg.includes('.')) return msg; // skip i18n-style keys like "auth.invalid_credentials"
  }
  return fallback;
}
