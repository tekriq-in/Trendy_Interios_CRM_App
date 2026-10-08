import { Tabs } from 'expo-router';
import { useSelector } from 'react-redux';
import { Redirect } from 'expo-router';
import type { RootState } from '../../src/store';

export default function AppLayout() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
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
