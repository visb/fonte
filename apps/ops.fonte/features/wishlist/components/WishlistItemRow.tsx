import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WishlistStatus } from '@fonte/types';
import type { WishlistItem } from '@fonte/api-client';

interface Props {
  item: WishlistItem;
  onRemove: (itemId: string) => void;
  isRemoving: boolean;
}

export function WishlistItemRow({ item, onRemove, isRemoving }: Props) {
  return (
    <View className="bg-white border-b border-gray-100 px-4 py-3">
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-900">{item.description}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {item.isRemovalRequested ? 'Remoção aguardando aprovação' : `Qtd: ${item.quantity}`}
          </Text>
        </View>
        {item.status === WishlistStatus.APPROVED && !item.isRemovalRequested && (
          <TouchableOpacity
            onPress={() => onRemove(item.id)}
            disabled={isRemoving}
            className="p-2"
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
      {item.status === WishlistStatus.REJECTED && item.rejectionReason && (
        <View className="mt-1.5 bg-red-50 rounded-lg px-3 py-2">
          <Text className="text-xs text-red-600">{item.rejectionReason}</Text>
        </View>
      )}
    </View>
  );
}
