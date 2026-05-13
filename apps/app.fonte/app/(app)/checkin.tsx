import { Stack } from 'expo-router';
import { CheckinPage } from '@/features/checkin/pages/CheckinPage';

export default function CheckinScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Check-in',
          headerShown: true,
          headerStyle: { backgroundColor: '#4c1d95' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <CheckinPage />
    </>
  );
}
