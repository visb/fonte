import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Relative } from '@fonte/api-client';

interface Props {
  relative: Relative;
}

export function RelativeCard({ relative }: Props) {
  return (
    <View className="border border-gray-100 rounded-xl px-4 py-3 bg-white">
      <Text className="text-sm font-semibold text-gray-900">{relative.name}</Text>
      {relative.relationship && (
        <Text className="text-xs text-gray-500 mt-0.5">{relative.relationship}</Text>
      )}
      {relative.phone && (
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${relative.phone}`)}
          className="flex-row items-center mt-1.5 gap-1"
        >
          <Ionicons name="call-outline" size={13} color="#2563eb" />
          <Text className="text-xs text-blue-600">{relative.phone}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
