import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// SecureStore only accepts letters, digits, '.', '-' and '_' in a key, but
// redux-persist names its key like "persist:auth".
const safeKey = (key: string) => key.replace(/[^\w.-]/g, '.');

/**
 * redux-persist storage backed by the OS keychain (iOS Keychain / Android
 * Keystore) instead of plain AsyncStorage. Used for the login tokens: anyone who
 * can read a phone's app storage (a backup, a rooted device, another app with
 * file access) could otherwise lift a valid session from AsyncStorage.
 * The web build has no keychain, so it falls back to AsyncStorage there.
 */
export const secureStorage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: (key: string) => SecureStore.getItemAsync(safeKey(key)),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(safeKey(key), value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(safeKey(key)),
      };
