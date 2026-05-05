import { Stack } from 'expo-router';

export default function StoreroomLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#111827', headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="index" options={{ title: 'Dispensa' }} />
      <Stack.Screen name="movement" options={{ title: 'Movimentar estoque' }} />
    </Stack>
  );
}
