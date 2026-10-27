import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserInfo { id?: string; name: string; email: string; role: string; initials: string; }

interface AuthState {
  // Tokens live in memory only — never serialised to localStorage (XSS protection).
  // Only non-sensitive user info is persisted.
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  setAuth: (accessToken: string, refreshToken: string, user?: UserInfo) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, ...(user ? { user } : {}) }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'ti-auth',
      // accessToken is memory-only (short-lived, XSS protection).
      // refreshToken + user profile are persisted so the session survives a page reload.
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
    },
  ),
);
