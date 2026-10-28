import { Tabs, router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { UsageTimerProvider } from "@/lib/UsageTimerContext";
import { useWarmHouseCache } from "@/lib/offline/prefetch";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useMenuAccess } from "@/features/menu/hooks/useMenuAccess";
import { canAccessMenuItem } from "@/features/menu/constants";

export default function AppLayout() {
  const { token, isLoading, staff } = useAuth();
  // Visibilidade das tabs vem do mesmo catálogo do menu (story 176): duas
  // fontes de verdade aqui viram item que leva a tela proibida.
  const { access } = useMenuAccess();
  const { isResident, isSupportGroupServant } = access;
  // Ponto ÚNICO de safe area do app autenticado (story 174): o wrapper paga o
  // inset do topo por todas as telas do grupo. Header nenhum — nem o
  // OfflineBanner — pode somar insets.top de novo, senão o app ganha gap duplo
  // quando está offline, que aqui é o estado esperado e não a exceção.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading && !token) router.replace("/(auth)/login");
  }, [token, isLoading]);

  // Pacote da casa em cache na abertura e a cada volta do background: é o que
  // permite abrir contagem/estoque já dentro da casa, sem sinal (story 171).
  useWarmHouseCache(token ? staff?.houseId : null);

  const tabs = (
    <View
      testID="app-safe-area"
      className="flex-1"
      // A faixa da status bar fica na cor do header para não abrir uma tira
      // branca acima dele. insets.bottom fica de fora de propósito: a tab bar
      // do expo-router já trata o inset inferior.
      style={{ paddingTop: insets.top, backgroundColor: "#272950" }}
    >
      <StatusBar style="light" />
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "#d1d5db",
          tabBarStyle: isSupportGroupServant
            ? { display: "none" }
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
            href: isSupportGroupServant || isResident ? null : undefined,
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
            href: canAccessMenuItem("residents", access) ? undefined : null,
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
        <Tabs.Screen name="contributions" options={{ title: 'Contribuições', headerShown: false, href: null }} />
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
              <Ionicons
                name="people-circle-outline"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="daily"
          options={{
            title: "Daily",
            headerShown: false,
            href: null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="git-compare-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="staff"
          options={{
            title: "Servos",
            headerShown: false,
            href: null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="id-card-outline" size={size} color={color} />
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
            href: canAccessMenuItem("supportGroups", access) ? undefined : null,
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
            // Escondido por ora (vai voltar).
            // href: canAccessMenuItem("messages", access) ? undefined : null,
            href: null,
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
            // Escondido por ora (vai voltar).
            // href: canAccessMenuItem("wishlist", access) ? undefined : null,
            href: null,
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
          name="sync"
          options={{
            title: "Pendências de envio",
            href: null,
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cloud-upload-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            href: isSupportGroupServant ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="menu-outline" size={size} color={color} />
            ),
          }}
        />
        {/* Perfil perdeu a tab para o Menu (story 176), mas a rota continua:
            é o "Editar perfil" do cabeçalho do menu que empurra ela. */}
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            href: null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="person-circle-outline"
                size={size}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );

  if (isResident) {
    return <UsageTimerProvider>{tabs}</UsageTimerProvider>;
  }

  return tabs;
}
