import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SupportGroupCheckin } from '@fonte/api-client';

interface Props {
  checkin: SupportGroupCheckin;
  onRemove: (checkinId: string) => void;
  isRemoving: boolean;
}

export function CheckinRow({ checkin, onRemove, isRemoving }: Props) {
  return (
    <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center">
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900">{checkin.residentName}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {new Date(checkin.checkedInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onRemove(checkin.id)} disabled={isRemoving} className="p-1">
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}
