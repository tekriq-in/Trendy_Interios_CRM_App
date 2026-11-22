import axios from 'axios';
import { router } from 'expo-router';
import { store } from '../store';
import { clearAuth } from '../store/slices/auth.slice';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 && err.response?.data?.message === 'auth.password_change_required') {
      router.replace('/change-password');
      return Promise.reject(err);
    }
    if (err.response?.status === 401) {
      store.dispatch(clearAuth());
    }
    return Promise.reject(err);
  },
);
