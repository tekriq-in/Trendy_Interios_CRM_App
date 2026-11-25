import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { StatusBar } from 'expo-status-bar';
import { store, persistor, type RootState } from '../src/store';
import i18n from '../src/i18n';

function AppInit() {
  const language = useSelector((s: RootState) => s.ui.language);

  // Apply the saved language (also re-applies whenever the user switches it).
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    // expo-notifications does not run on web
    if (Platform.OS !== 'web') {
      import('../src/services/notifications.service').then(({ registerForPushNotifications }) => {
        registerForPushNotifications();
      });
    }
  }, []);
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
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
