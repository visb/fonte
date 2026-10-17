import { Text, TouchableOpacity, View } from 'react-native';
import { Gender } from '@fonte/types';

interface OptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function GenderOption({ label, selected, onPress }: OptionProps) {
  return (
    <TouchableOpacity
      className={`flex-1 rounded-xl border py-2.5 items-center ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
      onPress={onPress}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-blue-600' : 'text-gray-600'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface Props {
  value: Gender;
  onChange: (gender: Gender) => void;
}

export function GenderSelector({ value, onChange }: Props) {
  return (
    <View className="flex-row gap-3">
      <GenderOption
        label="Masculino"
        selected={value === Gender.MALE}
        onPress={() => onChange(Gender.MALE)}
      />
      <GenderOption
        label="Feminino"
        selected={value === Gender.FEMALE}
        onPress={() => onChange(Gender.FEMALE)}
      />
    </View>
  );
}
