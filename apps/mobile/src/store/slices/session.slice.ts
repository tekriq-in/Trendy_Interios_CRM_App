import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { clearAuth } from './auth.slice';

interface SessionState {
  /** Permission slugs for the user's role (GET /auth/permissions), cached so buttons still show offline. */
  permissions: string[];
}

const initialState: SessionState = { permissions: [] };

/** Non-secret session data. Persisted in normal storage (the tokens are not). */
export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setPermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Signing out must not leave the previous user's permissions behind.
    builder.addCase(clearAuth, (state) => {
      state.permissions = [];
    });
  },
});

export const { setPermissions } = sessionSlice.actions;
export default sessionSlice.reducer;
