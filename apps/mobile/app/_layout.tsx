import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../src/store';
import '../src/i18n';
import { registerForPushNotifications } from '../src/services/notifications.service';

function AppInit() {
  useEffect(() => {
    registerForPushNotifications();
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
