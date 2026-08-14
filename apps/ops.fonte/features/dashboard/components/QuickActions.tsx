import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { QuickActionItem } from "@/features/menu/constants";

interface Props {
  /**
   * Atalhos já filtrados pelo acesso do usuário. Vêm do catálogo único
   * (`features/menu/constants.ts`, story 176) — a lista local que existia aqui
   * era a segunda fonte de verdade de rotas do app.
   */
  items: QuickActionItem[];
}

export function QuickActions({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <View>
      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Ações rápidas
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {items.map((a) => (
          <TouchableOpacity
            key={a.key}
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
