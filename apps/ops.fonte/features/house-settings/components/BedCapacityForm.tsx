import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { House } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { useRequestCapacityChange } from '../hooks/useHouseSettings';

const THEME = '#272950';
const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

const capacitySchema = z.object({
  generalCapacity: z.coerce.number().int('Informe um número inteiro').min(1, 'Mínimo 1 leito'),
  staffCapacity: z.coerce.number().int('Informe um número inteiro').min(1, 'Mínimo 1 leito'),
});
type CapacityForm = z.input<typeof capacitySchema>;

interface Props {
  house: House;
}

export function BedCapacityForm({ house }: Props) {
  const requestChange = useRequestCapacityChange(house.id);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<CapacityForm>({
    resolver: zodResolver(capacitySchema),
    defaultValues: {
      generalCapacity: house.generalCapacity ?? undefined,
      staffCapacity: house.staffCapacity ?? undefined,
    },
  });

  async function onSubmit(data: CapacityForm) {
    setError('');
    setSuccess(false);
    try {
      await requestChange.mutateAsync({
        generalCapacity: Number(data.generalCapacity),
        staffCapacity: Number(data.staffCapacity),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao enviar pedido.'));
    }
  }

  return (
    <View className="bg-white rounded-2xl shadow-sm p-4">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Leitos
      </Text>
      <Text className="text-xs text-gray-500 mb-4">
        Alterações dependem de aprovação do ADM.
      </Text>

      <View className="space-y-3">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Leitos para filhos</Text>
          <Controller
            control={control}
            name="generalCapacity"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={INPUT_CLASS}
                value={value != null ? String(value) : ''}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="number-pad"
                placeholder="0"
              />
            )}
          />
          {errors.generalCapacity && (
            <Text className="text-sm text-red-600 mt-1">{errors.generalCapacity.message}</Text>
          )}
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Leitos para servos</Text>
          <Controller
            control={control}
            name="staffCapacity"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={INPUT_CLASS}
                value={value != null ? String(value) : ''}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="number-pad"
                placeholder="0"
              />
            )}
          />
          {errors.staffCapacity && (
            <Text className="text-sm text-red-600 mt-1">{errors.staffCapacity.message}</Text>
          )}
        </View>

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        {success ? (
          <Text className="text-sm text-green-600">Pedido enviado para aprovação do ADM.</Text>
        ) : null}

        <TouchableOpacity
          className="rounded-lg py-3 items-center mt-1"
          style={{ backgroundColor: THEME }}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Solicitar alteração</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
