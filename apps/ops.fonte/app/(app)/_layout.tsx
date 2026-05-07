import { Tabs, router } from "expo-router";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";

export default function AppLayout() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !token) router.replace("/(auth)/login");
  }, [token, isLoading]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#d1d5db",
        tabBarStyle: { backgroundColor: "#272950", borderTopColor: "#272950" },
        headerStyle: {
          backgroundColor: "#272950",
          shadowColor: "transparent",
        },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="residents"
        options={{
          title: "Filhos",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => router.navigate("/(app)/residents"),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: "Ocorrências",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="storeroom"
        options={{
          title: "Dispensa",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
