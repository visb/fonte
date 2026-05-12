import { Stack } from "expo-router";

export default function MinistriesLayout() {
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
