import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { View, Text, TextInput } from 'react-native';
import type { Resident } from '@fonte/api-client';
import { todayInSaoPaulo } from '@fonte/types';
import { DateInput } from '@/components/shared/DateInput';
import type { IncidentFormData as FormData } from '../schema';
import { IncidentClassificationFields } from './IncidentClassificationFields';
import { ResidentMultiPicker } from './ResidentMultiPicker';

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
          render={({ field: { onChange, onBlur, value } }) => (
            // Story 226: máscara dd/mm/aaaa + calendário; o form segue com a ISO,
            // então o payload e a fila offline não mudam. Ocorrência nunca é futura.
            <DateInput
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              maxDate={todayInSaoPaulo()}
              accessibilityLabel="Data"
              error={errors.date?.message}
            />
          )}
        />
      </View>

      <IncidentClassificationFields control={control} errors={errors} />

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
          Filhos envolvidos (opcional)
        </Text>
        <Controller
          control={control}
          name="residentIds"
          render={({ field: { onChange, value } }) => (
            <ResidentMultiPicker value={value ?? []} residents={residents} onChange={onChange} />
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
