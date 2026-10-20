import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
  onYes: () => void;
  onNo: () => void;
}

/** Story 218 — primeiro passo: o filho já passou pela comunidade? */
export function AddResidentReturningStep({ onYes, onNo }: Props) {
  return (
    <View className="px-5 py-6 gap-4">
      <Text className="text-base text-gray-900 text-center">
        Este filho já passou pela Fonte de Misericórdia antes?
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        className="bg-blue-600 rounded-xl py-3 items-center"
        onPress={onYes}
      >
        <Text className="text-sm font-medium text-white">Sim</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        className="border border-gray-200 rounded-xl py-3 items-center"
        onPress={onNo}
      >
        <Text className="text-sm font-medium text-gray-700">Não, é a primeira vez</Text>
      </TouchableOpacity>
    </View>
  );
}
