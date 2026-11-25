import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { decodeJwt } from '../../utils/jwt';

export interface AuthUser {
  name: string;
  email: string;
  role: string;
  departmentName: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  user: AuthUser | null;
  /** Permission slugs for the user's role, loaded from GET /auth/permissions. */
  permissions: string[];
}

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  user: null,
  permissions: [],
};

function userFromToken(token: string): { userId: string | null; user: AuthUser | null } {
  const p = decodeJwt(token);
  if (!p) return { userId: null, user: null };
  return {
    userId: p.sub,
    user: {
      name: p.name || p.email || '',
      email: p.email ?? '',
      role: p.role ?? '',
      departmentName: p.department?.name ?? null,
    },
  };
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Stores a new session. Also used after a silent token refresh. */
    setAuth: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string; userId?: string }>,
    ) => {
      const { accessToken, refreshToken } = action.payload;
      const fromToken = userFromToken(accessToken);
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.userId = action.payload.userId ?? fromToken.userId;
      state.user = fromToken.user ?? state.user;
    },
    setPermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
    },
    clearAuth: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.userId = null;
      state.user = null;
      state.permissions = [];
    },
  },
});

export const { setAuth, setPermissions, clearAuth } = authSlice.actions;
export default authSlice.reducer;
