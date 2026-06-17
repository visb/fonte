import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { View, Text, TextInput } from 'react-native';

interface FormData {
  title: string;
  description?: string;
}

interface Props {
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  houseName?: string;
}

export function ActivityFormFields({ control, errors, houseName }: Props) {
  return (
    <View className="space-y-5">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          Título <Text className="text-red-500">*</Text>
        </Text>
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
              placeholder="Ex: Consertar o portão"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.title && (
          <Text className="text-xs text-red-500 mt-1">{errors.title.message}</Text>
        )}
      </View>

      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">Descrição</Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
              placeholder="Detalhe a atividade (opcional)..."
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
      </View>

      {houseName && (
        <View className="bg-gray-50 rounded-lg px-4 py-3">
          <Text className="text-xs text-gray-500">Casa</Text>
          <Text className="text-sm font-medium text-gray-800 mt-0.5">{houseName}</Text>
        </View>
      )}
    </View>
  );
}
