import { Pressable, Text, View } from 'react-native';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/** Opção de rádio do `ChangeMinistryModal` (story 205). */
export function MinistryOption({ label, selected, onPress, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      className={`flex-row items-center px-4 py-3 rounded-xl border ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
      onPress={onPress}
      disabled={disabled}
    >
      <View
        className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
          selected ? 'border-blue-500' : 'border-gray-300'
        }`}
      >
        {selected && <View className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
      </View>
      <Text className="text-sm text-gray-800 flex-1">{label}</Text>
    </Pressable>
  );
}
