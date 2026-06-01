import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SupplyRoomItem } from "@fonte/api-client";
import { formatQuantity } from "@/features/supply-room/utils";
import { CategoryBadge } from "./CategoryBadge";

type Props = {
  item: SupplyRoomItem;
  onPress: () => void;
};

export function SupplyRoomItemCard({ item, onPress }: Props) {
  const isLowStock = Number(item.currentQuantity) <= 5;

  return (
    <Pressable
      className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center"
      onPress={onPress}
    >
      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
        <Ionicons name="spray-outline" size={20} color="#2563eb" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          Estoque: {formatQuantity(item.currentQuantity)} {item.unit}
        </Text>
        <View className="mt-1">
          <CategoryBadge category={item.category} />
        </View>
      </View>
      <View className="items-end gap-2">
        {isLowStock && (
          <View className="bg-orange-50 rounded-full px-2 py-0.5">
            <Text className="text-xs text-orange-600 font-medium">Baixo</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </View>
    </Pressable>
  );
}
