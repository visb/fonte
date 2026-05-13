import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WishlistItem } from '@fonte/api-client';

interface Props {
  item: WishlistItem;
}

export function WishlistItemCard({ item }: Props) {
  return (
    <View className="flex-row items-start gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
      <View className="w-9 h-9 rounded-full bg-violet-100 items-center justify-center mt-0.5 shrink-0">
        <Ionicons name="gift-outline" size={18} color="#7c3aed" />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-gray-900">{item.description}</Text>
        {item.quantity > 1 && (
          <Text className="text-xs text-gray-500 mt-0.5">Quantidade: {item.quantity}</Text>
        )}
      </View>
    </View>
  );
}
