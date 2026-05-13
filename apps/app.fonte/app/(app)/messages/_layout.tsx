import { Stack } from 'expo-router';

export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#4c1d95' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mensagens' }} />
      <Stack.Screen name="resident" options={{ title: 'Chat' }} />
      <Stack.Screen name="[staffId]" options={{ title: 'Chat' }} />
    </Stack>
  );
}
