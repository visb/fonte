import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const ACTIONS = [
  {
    label: "Nova ocorrência",
    icon: "warning-outline" as const,
    color: "#dc2626",
    bg: "#fef2f2",
    route: "/(app)/incidents/new",
  },
  {
    label: "Ver filhos",
    icon: "people-outline" as const,
    color: "#9333ea",
    bg: "#faf5ff",
    route: "/(app)/residents",
  },
  {
    label: "Ministérios",
    icon: "people-circle-outline" as const,
    color: "#0369a1",
    bg: "#f0f9ff",
    route: "/(app)/ministries",
  },
  {
    label: "Dispensa",
    icon: "cube-outline" as const,
    color: "#16a34a",
    bg: "#f0fdf4",
    route: "/(app)/storeroom",
  },
  {
    label: "Almoxarifado",
    icon: "spray-outline" as const,
    color: "#2563eb",
    bg: "#eff6ff",
    route: "/(app)/supply-room",
  },
  {
    label: "Faturamento",
    icon: "storefront-outline" as const,
    color: "#b45309",
    bg: "#fffbeb",
    route: "/(app)/street-sales",
  },
];

export function QuickActions() {
  return (
    <View>
      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Ações rápidas
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.label}
            onPress={() => router.push(a.route as never)}
            className="w-[47%] bg-white rounded-xl border border-gray-100 p-4 items-center"
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center mb-2"
              style={{ backgroundColor: a.bg }}
            >
              <Ionicons name={a.icon} size={24} color={a.color} />
            </View>
            <Text className="text-sm font-medium text-gray-700 text-center">
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
