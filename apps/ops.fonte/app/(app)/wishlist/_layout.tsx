import { Stack } from 'expo-router';

export default function WishlistLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#272950' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Lista de Pedidos' }} />
    </Stack>
  );
}
