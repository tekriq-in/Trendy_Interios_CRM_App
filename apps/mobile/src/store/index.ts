import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from './slices/auth.slice';
import sessionReducer from './slices/session.slice';
import offlineQueueReducer from './slices/offline-queue.slice';
import uiReducer from './slices/ui.slice';
import { secureStorage } from './secure-storage';

// The login tokens go to the OS keychain; everything else to normal storage.
const authPersistConfig = {
  key: 'auth',
  storage: secureStorage,
  whitelist: ['accessToken', 'refreshToken', 'userId'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  session: sessionReducer,
  offlineQueue: offlineQueueReducer,
  ui: uiReducer,
});

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['session', 'offlineQueue', 'ui'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export const persistor = persistStore(store);

/**
 * Earlier versions kept the tokens inside the plain-text "persist:root" blob.
 * Remove them from there so an old copy of a session is not left lying around.
 * (Those users are signed out once and sign in again; the new tokens are kept
 * in the keychain.)
 */
async function purgeLegacyTokens(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('persist:root');
    if (!raw) return;
    const blob = JSON.parse(raw) as Record<string, unknown>;
    if ('auth' in blob) {
      delete blob.auth;
      await AsyncStorage.setItem('persist:root', JSON.stringify(blob));
    }
  } catch {
    // Nothing to clean up, or storage unavailable: safe to ignore.
  }
}
void purgeLegacyTokens();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
