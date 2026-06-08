import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Notification } from '@fonte/api-client';
import { relativeTime } from '../lib/relativeTime';

type Props = {
  item: Notification;
  onPress: (item: Notification) => void;
  onMarkRead: (id: string) => void;
};

export function NotificationRow({ item, onPress, onMarkRead }: Props) {
  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      className={`px-4 py-3 border-b border-gray-100 ${item.read ? 'bg-white' : 'bg-blue-50'}`}
    >
      <View className="flex-row items-start gap-2">
        {!item.read && <View className="mt-1.5 h-2 w-2 rounded-full bg-blue-600" />}
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text
              className={`text-sm text-gray-900 flex-1 ${item.read ? '' : 'font-semibold'}`}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text className="ml-2 text-xs text-gray-400">{relativeTime(item.createdAt)}</Text>
          </View>
          {item.body ? (
            <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
        </View>
        {!item.read && (
          <TouchableOpacity
            onPress={() => onMarkRead(item.id)}
            accessibilityLabel="Marcar como lida"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="ml-1 p-1"
          >
            <Ionicons name="checkmark-done" size={18} color="#2563eb" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
