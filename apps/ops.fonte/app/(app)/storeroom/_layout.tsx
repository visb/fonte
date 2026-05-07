import { Stack } from "expo-router";

export default function StoreroomLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#272950",
        },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Dispensa" }} />
      <Stack.Screen name="movement" options={{ title: "Movimentar estoque" }} />
    </Stack>
  );
}
