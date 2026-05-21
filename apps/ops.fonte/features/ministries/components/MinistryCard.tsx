import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { HouseMinistry } from '@fonte/api-client';

interface Props {
  ministry: HouseMinistry;
}

export function MinistryCard({ ministry }: Props) {
  return (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 border border-gray-200"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => router.push(`/(app)/ministries/${ministry.id}` as any)}
      activeOpacity={0.7}
    >
      <Text className="text-base font-semibold text-gray-900">{ministry.name}</Text>
      <Text className="text-sm text-gray-500 mt-1">
        {ministry.leaderName ? `Líder: ${ministry.leaderName}` : 'Sem líder definido'}
      </Text>
      <View className="flex-row gap-4 mt-2">
        <View className="flex-row items-center gap-1">
          <Ionicons name="person-outline" size={13} color="#6b7280" />
          <Text className="text-xs text-gray-500">
            {ministry.filhoCount} {ministry.filhoCount === 1 ? 'filho' : 'filhos'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="people-outline" size={13} color="#6b7280" />
          <Text className="text-xs text-gray-500">
            {ministry.servoCount} {ministry.servoCount === 1 ? 'servo' : 'servos'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
