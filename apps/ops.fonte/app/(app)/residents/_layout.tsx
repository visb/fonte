import { Stack } from 'expo-router';

export default function ResidentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Filhos' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalhe' }} />
    </Stack>
  );
}
