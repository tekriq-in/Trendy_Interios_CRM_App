import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { useSelector } from 'react-redux';
import { Redirect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineQueue } from '../../src/services/sync.service';
import type { RootState } from '../../src/store';

export default function AppLayout() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isNowConnected = state.isConnected === true;
      // Only sync when transitioning from offline → online
      if (isNowConnected && wasConnected.current === false) {
        syncOfflineQueue().catch(() => {});
      }
      wasConnected.current = isNowConnected;
    });
    return () => unsubscribe();
  }, []);

  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        headerShown: false,
      }}
    >
      <Tabs.Screen name="projects/index" options={{ title: 'Projects' }} />
      <Tabs.Screen name="tasks/index" options={{ title: 'Tasks' }} />
    </Tabs>
  );
}
