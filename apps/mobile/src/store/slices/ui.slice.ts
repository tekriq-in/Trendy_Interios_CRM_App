import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Language = 'en' | 'ta';

interface UiState {
  language: Language;
}

const initialState: UiState = { language: 'en' };

/** Persisted UI preferences (the SOW requires English and Tamil from day one). */
export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
  },
});

export const { setLanguage } = uiSlice.actions;
export default uiSlice.reducer;
