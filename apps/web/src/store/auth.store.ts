import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserInfo { id?: string; name: string; email: string; role: string; initials: string; }

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  // True once Zustand has finished reading from localStorage.
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setAuth: (accessToken: string, refreshToken: string, user?: UserInfo) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, ...(user ? { user } : {}) }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'ti-auth',
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
