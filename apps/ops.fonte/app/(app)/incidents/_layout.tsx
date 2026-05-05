import { Stack } from 'expo-router';

export default function IncidentsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111827', headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="index" options={{ title: 'Ocorrências' }} />
      <Stack.Screen name="new" options={{ title: 'Nova ocorrência' }} />
    </Stack>
  );
}
