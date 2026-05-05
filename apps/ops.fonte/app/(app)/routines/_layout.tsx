import { Stack } from 'expo-router';

export default function RoutinesLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111827', headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="index" options={{ title: 'Rotina diária' }} />
      <Stack.Screen name="new" options={{ title: 'Nova entrada' }} />
    </Stack>
  );
}
