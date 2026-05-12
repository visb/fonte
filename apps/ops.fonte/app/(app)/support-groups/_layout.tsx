import { Stack } from 'expo-router';

export default function SupportGroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#272950' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    />
  );
}
