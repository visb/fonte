import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';

interface Props {
  resident: {
    id: string;
    name: string;
    photoUrl?: string | null;
    photoThumbUrl?: string | null;
  };
  confirmed: boolean;
  onConfirm: () => void;
  onRemove: () => void;
}

export function CensusListItem({ resident, confirmed, onConfirm, onRemove }: Props) {
  const thumbUrl = resolveAssetUrl(resident.photoThumbUrl ?? resident.photoUrl);
  return (
    <View
      className={`bg-white rounded-xl border px-4 py-3 flex-row items-center ${confirmed ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}
    >
      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3 overflow-hidden">
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} className="w-10 h-10 rounded-full" />
        ) : (
          <Ionicons name="person-outline" size={20} color="#2563eb" />
        )}
      </View>
      <Text className="flex-1 text-sm font-semibold text-gray-900">{resident.name}</Text>

      <TouchableOpacity
        className={`w-10 h-10 rounded-full items-center justify-center mr-2 ${confirmed ? 'bg-green-600' : 'bg-green-50'}`}
        onPress={onConfirm}
      >
        <Ionicons name="checkmark" size={20} color={confirmed ? '#fff' : '#16a34a'} />
      </TouchableOpacity>
      <TouchableOpacity
        className="w-10 h-10 rounded-full items-center justify-center bg-red-50"
        onPress={onRemove}
      >
        <Ionicons name="trash-outline" size={18} color="#dc2626" />
      </TouchableOpacity>
    </View>
  );
}
