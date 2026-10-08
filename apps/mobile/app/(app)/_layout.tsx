import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { useSelector } from 'react-redux';
import { Redirect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { syncOfflineQueue } from '../../src/services/sync.service';
import type { RootState } from '../../src/store';

export default function AppLayout() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isNowConnected = state.isConnected === true;
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
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="projects/index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          title: 'My Tasks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="blockers/index"
        options={{
          title: 'Blockers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="projects/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="projects/[id]/chat" options={{ href: null }} />
    </Tabs>
  );
}
