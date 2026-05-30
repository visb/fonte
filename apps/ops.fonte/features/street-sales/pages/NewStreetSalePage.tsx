import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { StreetSaleType } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { DatePickerModal } from '@/components/DatePickerModal';
import { useCreateStreetSale } from '../hooks/useStreetSales';
import { StreetSaleFormFields } from '../components/StreetSaleFormFields';

const parseAmount = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n * 100);
};

const amountSchema = z
  .string()
  .regex(/^\d+([.,]\d{0,2})?$/, 'Valor inválido')
  .or(z.literal(''))
  .default('0');

export const streetSaleSchema = z.object({
  date: z.string().min(1),
  type: z.nativeEnum(StreetSaleType),
  quantity: z.string().regex(/^\d+$/, 'Informe a quantidade').refine((v) => parseInt(v) > 0, 'Deve ser maior que zero'),
  amountPix: amountSchema,
  amountCash: amountSchema,
  amountCard: amountSchema,
});

export type StreetSaleFormData = z.infer<typeof streetSaleSchema>;

const today = new Date().toISOString().slice(0, 10);

export function NewStreetSalePage() {
  const { staff } = useAuth();
  const mutation = useCreateStreetSale();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<StreetSaleFormData>({
    resolver: zodResolver(streetSaleSchema),
    defaultValues: {
      date: today,
      type: StreetSaleType.BREAD,
      quantity: '',
      amountPix: '',
      amountCash: '',
      amountCard: '',
    },
  });

  const [dateValue, amountPix, amountCash, amountCard] = useWatch({
    control,
    name: ['date', 'amountPix', 'amountCash', 'amountCard'],
  });

  const totalAmount = String(
    parseFloat((amountPix || '0').replace(',', '.') || '0') +
    parseFloat((amountCash || '0').replace(',', '.') || '0') +
    parseFloat((amountCard || '0').replace(',', '.') || '0')
  );

  const formatDateLabel = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const onSubmit = (data: StreetSaleFormData) => {
    if (!staff?.houseId) return;

    mutation.mutate(
      {
        houseId: staff.houseId,
        date: data.date,
        type: data.type,
        quantity: parseInt(data.quantity),
        amountPix: parseAmount(data.amountPix),
        amountCash: parseAmount(data.amountCash),
        amountCard: parseAmount(data.amountCard),
      },
      {
        onSuccess: () =>
          router.replace({
            pathname: '/(app)/street-sales',
            params: { successMsg: 'Faturamento registrado com sucesso.' },
          } as never),
        onError: () =>
          Alert.alert('Erro', 'Não foi possível registrar o faturamento.'),
      },
    );
  };

  return (
    <>
      <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
        <View className="px-4 py-5">
          <StreetSaleFormFields
            control={control}
            errors={errors}
            totalAmount={totalAmount}
            dateLabel={formatDateLabel(dateValue ?? today)}
            onDatePress={() => setShowDatePicker(true)}
          />

          <TouchableOpacity
            className="bg-indigo-900 rounded-lg py-3.5 items-center mt-6"
            onPress={handleSubmit(onSubmit)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Registrar faturamento</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={dateValue ?? today}
        onChange={(date) => setValue('date', date)}
        onClose={() => setShowDatePicker(false)}
      />
    </>
  );
}
