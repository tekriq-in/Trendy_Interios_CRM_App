import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSelector } from 'react-redux';
import { Redirect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { syncOfflineQueue } from '../../src/services/sync.service';
import type { RootState } from '../../src/store';
import { SocketProvider, useSocket } from '../../src/context/socket.context';

function AppTabs() {
  const { unreadMap } = useSocket();
  const totalUnread = Object.values(unreadMap).reduce((sum, n) => sum + n, 0);

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
            <Ionicons name="folder-outline" size={size} color={typeof color === 'string' ? color : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          title: 'My Tasks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={typeof color === 'string' ? color : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: 'Chat',
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={typeof color === 'string' ? color : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen
        name="blockers/index"
        options={{
          title: 'Blockers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" size={size} color={typeof color === 'string' ? color : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={typeof color === 'string' ? color : '#9CA3AF'} />
          ),
        }}
      />
      <Tabs.Screen name="projects/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="projects/[id]/chat" options={{ href: null }} />
      <Tabs.Screen name="chat/[groupId]" options={{ href: null }} />
    </Tabs>
  );
}

export default function AppLayout() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const wasConnected = useRef<boolean | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isNowConnected = state.isConnected === true;
      setIsConnected(isNowConnected);
      if (isNowConnected && wasConnected.current === false) {
        syncOfflineQueue().catch(() => {});
      }
      wasConnected.current = isNowConnected;
    });
    return () => unsubscribe();
  }, []);

  if (!token) return <Redirect href="/login" />;

  return (
    <View style={styles.root}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Working offline — changes will sync when connected</Text>
        </View>
      )}
      <SocketProvider>
        <AppTabs />
      </SocketProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  offlineBanner: {
    backgroundColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    color: '#78350F',
    fontSize: 12,
    fontWeight: '600',
  },
});
