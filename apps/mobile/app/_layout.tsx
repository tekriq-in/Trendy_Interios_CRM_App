import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../src/store';
import '../src/i18n';

function AppInit() {
  useEffect(() => {
    // expo-notifications does not run on web
    if (Platform.OS !== 'web') {
      import('../src/services/notifications.service').then(({ registerForPushNotifications }) => {
        registerForPushNotifications();
      });
    }
  }, []);
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppInit />
      </PersistGate>
    </Provider>
  );
}
