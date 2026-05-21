import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WishlistPendingItem } from '@fonte/api-client';

interface Props {
  item: WishlistPendingItem;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  isPending: boolean;
}

export function PendingWishlistItemRow({ item, onApprove, onReject, isPending }: Props) {
  return (
    <View className="bg-white border-b border-gray-100 px-4 py-3">
      <Text className="text-xs text-gray-400 mb-1">{item.residentName}</Text>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-medium text-gray-900">{item.description}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            Qtd: {item.quantity}{item.isRemovalRequested ? ' · Solicitando remoção' : ''}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => onApprove(item.id)}
            disabled={isPending}
            className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5"
          >
            <Ionicons name="checkmark" size={16} color="#16a34a" />
          </Pressable>
          <Pressable
            onPress={() => onReject(item.id)}
            disabled={isPending}
            className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5"
          >
            <Ionicons name="close" size={16} color="#dc2626" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
