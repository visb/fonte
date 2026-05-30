import { Stack } from 'expo-router';

export default function StreetSalesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#272950' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Faturamento' }} />
      <Stack.Screen name="new" options={{ title: 'Novo registro' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar registro' }} />
    </Stack>
  );
}
