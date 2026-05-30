import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import type { StreetSale } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { DatePickerModal } from '@/components/DatePickerModal';
import { useUpdateStreetSale } from '../hooks/useStreetSales';
import { StreetSaleFormFields } from '../components/StreetSaleFormFields';
import type { StreetSaleFormData as FormData } from './NewStreetSalePage';
import { streetSaleSchema } from './NewStreetSalePage';

const parseAmount = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n * 100);
};

const formatCentavos = (c: number) => (c / 100).toFixed(2).replace('.', ',');

interface Props {
  sale: StreetSale;
}

export function EditStreetSalePage({ sale }: Props) {
  const { staff } = useAuth();
  const mutation = useUpdateStreetSale(staff?.houseId ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(streetSaleSchema),
    defaultValues: {
      date: sale.date,
      type: sale.type,
      quantity: String(sale.quantity),
      amountPix: formatCentavos(sale.amountPix),
      amountCash: formatCentavos(sale.amountCash),
      amountCard: formatCentavos(sale.amountCard),
    },
  });

  const [dateValue, amountPix, amountCash, amountCard] = useWatch({
    control,
    name: ['date', 'amountPix', 'amountCash', 'amountCard'],
  });

  const totalAmount = String(
    parseFloat((amountPix || '0').replace(',', '.') || '0') +
    parseFloat((amountCash || '0').replace(',', '.') || '0') +
    parseFloat((amountCard || '0').replace(',', '.') || '0'),
  );

  const formatDateLabel = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        id: sale.id,
        data: {
          date: data.date,
          type: data.type,
          quantity: parseInt(data.quantity),
          amountPix: parseAmount(data.amountPix),
          amountCash: parseAmount(data.amountCash),
          amountCard: parseAmount(data.amountCard),
        },
      },
      {
        onSuccess: () =>
          Alert.alert('Sucesso', 'Registro atualizado.', [
            { text: 'OK', onPress: () => router.back() },
          ]),
        onError: () =>
          Alert.alert('Erro', 'Não foi possível atualizar o registro.'),
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
            dateLabel={formatDateLabel(dateValue ?? sale.date)}
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
              <Text className="text-white font-semibold text-base">Salvar alterações</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={dateValue ?? sale.date}
        onChange={(date) => setValue('date', date)}
        onClose={() => setShowDatePicker(false)}
      />
    </>
  );
}
