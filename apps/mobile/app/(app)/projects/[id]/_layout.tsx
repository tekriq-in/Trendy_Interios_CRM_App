import { Stack } from 'expo-router';

export default function ProjectDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="purchase-items" options={{ title: 'Purchase Items', headerShown: true }} />
    </Stack>
  );
}
