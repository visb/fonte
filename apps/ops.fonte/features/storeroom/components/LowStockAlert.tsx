import { View, Text } from "react-native";
import type { StoreroomItem } from "@fonte/api-client";
import { formatQuantity } from "@/features/storeroom/utils";

type Props = {
  items: StoreroomItem[];
};

export function LowStockAlert({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <View className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
      <Text className="text-sm font-semibold text-orange-700 mb-1">
        Estoque baixo ({items.length} {items.length === 1 ? "item" : "itens"})
      </Text>
      {items.map((i) => (
        <Text key={i.id} className="text-xs text-orange-600">
          • {i.name}: {formatQuantity(i.currentQuantity)} {i.unit}
        </Text>
      ))}
    </View>
  );
}
