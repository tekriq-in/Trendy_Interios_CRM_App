import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function drainQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status !== 401 || original._retried) {
      return Promise.reject(err);
    }

    const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();

    if (!refreshToken) {
      clearAuth();
      // Don't redirect when the login endpoint itself returned 401 — let the
      // login page's catch block handle it and show the inline error message.
      if (typeof window !== 'undefined' && !original.url?.includes('/auth/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    original._retried = true;
    isRefreshing = true;

    try {
      const res = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/auth/refresh`,
        { refreshToken },
      );
      const { accessToken, refreshToken: newRefreshToken } = res.data;
      setAuth(accessToken, newRefreshToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      drainQueue(accessToken);
      return apiClient(original);
    } catch {
      clearAuth();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
