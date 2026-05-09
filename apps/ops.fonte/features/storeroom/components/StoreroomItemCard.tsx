import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StoreroomItem } from "@fonte/api-client";
import {
  formatQuantity,
  formatAutonomy,
  getWeeklyAverage,
} from "@/features/storeroom/utils";

type Props = {
  item: StoreroomItem;
  onPress: () => void;
};

export function StoreroomItemCard({ item, onPress }: Props) {
  const weeklyAverage = getWeeklyAverage(item);
  const isLowStock = Number(item.currentQuantity) <= 5;

  return (
    <Pressable
      className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center"
      onPress={onPress}
    >
      <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
        <Ionicons name="cube-outline" size={20} color="#16a34a" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          Estoque: {formatQuantity(item.currentQuantity)} {item.unit}
        </Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          Média:{" "}
          {weeklyAverage > 0
            ? `${formatQuantity(weeklyAverage)} ${item.unit}/sem.`
            : "sem média"}
        </Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          Autonomia: {formatAutonomy(item)}
        </Text>
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
