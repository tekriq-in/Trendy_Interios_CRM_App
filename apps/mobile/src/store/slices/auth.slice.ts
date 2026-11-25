import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { decodeJwt } from '../../utils/jwt';

/**
 * Login tokens only. This slice is persisted to the OS keychain (see store/index.ts),
 * so it holds nothing that is not a secret or needed to restore the session. The
 * display profile is read from the access token (useCurrentUser) and the role's
 * permissions live in the `session` slice.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
}

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
};

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
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.userId = action.payload.userId ?? decodeJwt(accessToken)?.sub ?? state.userId;
    },
    clearAuth: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.userId = null;
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
