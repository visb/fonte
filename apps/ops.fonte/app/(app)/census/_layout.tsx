import { Stack } from "expo-router";

export default function CensusLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#272950" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Contagem" }} />
    </Stack>
  );
}
