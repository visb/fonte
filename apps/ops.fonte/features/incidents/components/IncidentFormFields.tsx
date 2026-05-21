import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { View, Text, TextInput } from 'react-native';
import type { Resident } from '@fonte/api-client';
import { IncidentSeverity } from '@fonte/types';
import { SeveritySelector } from './SeveritySelector';
import { ResidentPicker } from './ResidentPicker';

interface FormData {
  date: string;
  severity: IncidentSeverity;
  description: string;
  residentId?: string;
}

interface Props {
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  residents: Resident[];
  responsibleName?: string;
}

export function IncidentFormFields({ control, errors, residents, responsibleName }: Props) {
  return (
    <View className="space-y-5">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
        <Controller
          control={control}
          name="date"
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
              value={value}
              onChangeText={onChange}
              placeholder="AAAA-MM-DD"
            />
          )}
        />
      </View>

      <View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Severidade</Text>
        <Controller
          control={control}
          name="severity"
          render={({ field: { onChange, value } }) => (
            <SeveritySelector value={value} onChange={onChange} />
          )}
        />
      </View>

      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          Descrição <Text className="text-red-500">*</Text>
        </Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
              placeholder="Descreva a ocorrência com detalhes..."
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.description && (
          <Text className="text-xs text-red-500 mt-1">{errors.description.message}</Text>
        )}
      </View>

      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          Filho envolvido (opcional)
        </Text>
        <Controller
          control={control}
          name="residentId"
          render={({ field: { onChange, value } }) => (
            <ResidentPicker value={value ?? ''} residents={residents} onChange={onChange} />
          )}
        />
      </View>

      {responsibleName && (
        <View className="bg-gray-50 rounded-lg px-4 py-3">
          <Text className="text-xs text-gray-500">Responsável</Text>
          <Text className="text-sm font-medium text-gray-800 mt-0.5">{responsibleName}</Text>
        </View>
      )}
    </View>
  );
}
