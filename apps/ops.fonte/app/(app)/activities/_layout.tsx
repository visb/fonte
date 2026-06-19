import { Stack } from "expo-router";

export default function ActivitiesLayout() {
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
      <Stack.Screen name="index" options={{ title: "Atividades" }} />
      <Stack.Screen name="new" options={{ title: "Nova atividade" }} />
      <Stack.Screen name="[id]" options={{ title: "Detalhes da atividade" }} />
    </Stack>
  );
}
