import { Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export function PickContributionResidentRow({ resident, houseId }: { resident: { id: string; name: string }; houseId: string }) {
  return (
    <TouchableOpacity className="p-4 border-b border-gray-100" accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/residents/declare-products', params: {
        residentId: resident.id, houseId, returnTo: 'contributions',
      } } as never)}>
      <Text className="text-base text-gray-900">{resident.name}</Text>
    </TouchableOpacity>
  );
}
