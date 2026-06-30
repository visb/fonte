import { Tabs, router } from "expo-router";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { UsageTimerProvider } from "@/lib/UsageTimerContext";

export default function AppLayout() {
  const { token, isLoading, staff, isResident, canSendMessagesToFamilies, canModerateMessages } = useAuth();
  const isSupportGroupServant = !!staff && !staff.houseId;

  useEffect(() => {
    if (!isLoading && !token) router.replace("/(auth)/login");
  }, [token, isLoading]);

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#d1d5db",
        tabBarStyle: isSupportGroupServant
          ? { display: 'none' }
          : { backgroundColor: "#272950", borderTopColor: "#272950" },
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
          title: "Início",
          headerShown: false,
          href: (isSupportGroupServant || isResident) ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="resident-home"
        options={{
          title: "Início",
          href: isResident ? undefined : null,
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
          href: (isSupportGroupServant || isResident) ? null : undefined,
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
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Atividades",
          headerShown: false,
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ministries"
        options={{
          title: "Ministérios",
          headerShown: false,
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="storeroom"
        options={{
          title: "Dispensa",
          headerShown: false,
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="supply-room"
        options={{
          title: "Almoxarifado",
          headerShown: false,
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="support-groups"
        options={{
          title: "Apoio",
          headerShown: false,
          href: isSupportGroupServant ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-circle-outline" size={size} color={color} />
          ),
        }}
        listeners={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tabPress: () => router.navigate("/(app)/support-groups" as any),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Eventos internos",
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Mensagens",
          headerShown: false,
          href: (isSupportGroupServant || (!isResident && !canSendMessagesToFamilies && !canModerateMessages)) ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
        listeners={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tabPress: () => router.navigate("/(app)/messages" as any),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: "Pedidos",
          headerShown: false,
          href: (isSupportGroupServant || (!isResident && !canModerateMessages)) ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift-outline" size={size} color={color} />
          ),
        }}
        listeners={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tabPress: () => router.navigate("/(app)/wishlist" as any),
        }}
      />
      <Tabs.Screen
        name="street-sales"
        options={{
          title: "Faturamento",
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="house-settings"
        options={{
          title: "Configurações da casa",
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="census"
        options={{
          title: "Contagem",
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          href: isSupportGroupServant ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );

  if (isResident) {
    return <UsageTimerProvider>{tabs}</UsageTimerProvider>;
  }

  return tabs;
}
