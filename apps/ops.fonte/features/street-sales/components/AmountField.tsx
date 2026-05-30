import { View, Text, TextInput } from 'react-native';
import type { Control, FieldPath, FieldValues, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  errors?: FieldErrors<T>;
};

export function AmountField<T extends FieldValues>({ control, name, label, errors }: Props<T>) {
  const error = errors?.[name];
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">{label}</Text>
      <View className="flex-row items-center border border-gray-300 rounded-lg bg-gray-50 px-4 py-3">
        <Text className="text-sm text-gray-500 mr-1">R$</Text>
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="flex-1 text-sm text-gray-900"
              keyboardType="decimal-pad"
              placeholder="0,00"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
      </View>
      {error && (
        <Text className="text-xs text-red-500 mt-1">{String(error.message ?? '')}</Text>
      )}
    </View>
  );
}
