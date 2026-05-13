import { Stack } from 'expo-router';

export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#272950' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mensagens' }} />
      <Stack.Screen name="moderation" options={{ title: 'Moderação' }} />
      <Stack.Screen name="[residentId]/[relativeId]" options={{ title: 'Conversa' }} />
    </Stack>
  );
}
