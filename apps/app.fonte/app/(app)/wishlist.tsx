import { Stack } from 'expo-router';
import { WishlistPage } from '@/features/wishlist/pages/WishlistPage';

export default function WishlistScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Pedidos',
          headerShown: true,
          headerStyle: { backgroundColor: '#4c1d95' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <WishlistPage />
    </>
  );
}
