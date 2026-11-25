import { useEffect, useRef } from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { syncOfflineQueue } from '../../src/services/sync.service';
import { registerForPushNotifications } from '../../src/services/notifications.service';
import type { RootState } from '../../src/store';
import { SocketProvider, useSocket } from '../../src/context/socket.context';
import { usePermissions } from '../../src/hooks/usePermissions';
import { colors } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  // The tab bar hands us a ColorValue (string | opaque native colour), but the
  // icon wants a string, so fall back to the inactive colour for non-strings.
  // eslint-disable-next-line react/display-name
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons
      name={focused ? active : inactive}
      size={26}
      color={typeof color === 'string' ? color : colors.textSubtle}
    />
  );
}

function AppTabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { unreadMap } = useSocket();
  const totalUnread = Object.values(unreadMap).reduce((sum, n) => sum + n, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{ title: t('nav.home'), tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="projects"
        options={{ title: t('nav.projects'), tabBarIcon: tabIcon('albums', 'albums-outline') }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{ title: t('nav.tasks'), tabBarIcon: tabIcon('checkbox', 'checkbox-outline') }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('nav.chat'),
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarIcon: tabIcon('chatbubbles', 'chatbubbles-outline'),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{ title: t('nav.profile'), tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }}
      />
      {/* Reached from Home and from a project, not from the tab bar. */}
      <Tabs.Screen name="blockers/index" options={{ href: null }} />
      <Tabs.Screen name="handovers/index" options={{ href: null }} />
    </Tabs>
  );
}

export default function AppLayout() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const wasConnected = useRef<boolean | null>(null);
  usePermissions();

  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      // Flush queued changes the moment we come back online.
      if (online && wasConnected.current === false) {
        syncOfflineQueue().catch(() => {});
      }
      wasConnected.current = online;
    });
    return () => unsubscribe();
  }, []);

  if (!token) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SocketProvider>
        <AppTabs />
      </SocketProvider>
    </View>
  );
}
