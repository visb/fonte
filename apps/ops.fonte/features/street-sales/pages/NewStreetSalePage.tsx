import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { notify } from '@/lib/dialogs';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { StreetSaleType, todayInSaoPaulo } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { pastOrTodayDateSchema } from '@/lib/date';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
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
  // Story 209: digitável; lançamento retroativo pode, futuro não.
  date: pastOrTodayDateSchema,
  type: z.nativeEnum(StreetSaleType),
  quantity: z.string().regex(/^\d+$/, 'Informe a quantidade').refine((v) => parseInt(v) > 0, 'Deve ser maior que zero'),
  amountPix: amountSchema,
  amountCash: amountSchema,
  amountCard: amountSchema,
});

export type StreetSaleFormData = z.infer<typeof streetSaleSchema>;

export function NewStreetSalePage() {
  const { staff } = useAuth();
  const mutation = useCreateStreetSale();
  const submit = useFieldSubmit(mutation);

  const { control, handleSubmit, formState: { errors } } = useForm<StreetSaleFormData>({
    resolver: zodResolver(streetSaleSchema),
    defaultValues: {
      // "Hoje" no fuso da operação, não o dia UTC (story 209, decisão 8).
      date: todayInSaoPaulo(),
      type: StreetSaleType.BREAD,
      quantity: '',
      amountPix: '',
      amountCash: '',
      amountCard: '',
    },
  });

  const [amountPix, amountCash, amountCard] = useWatch({
    control,
    name: ['amountPix', 'amountCash', 'amountCard'],
  });

  const totalAmount = String(
    parseFloat((amountPix || '0').replace(',', '.') || '0') +
    parseFloat((amountCash || '0').replace(',', '.') || '0') +
    parseFloat((amountCard || '0').replace(',', '.') || '0')
  );

  const onSubmit = (data: StreetSaleFormData) => {
    if (!staff?.houseId) return;

    // Venda de rua acontece fora da casa, quase sempre sem sinal: offline entra
    // na fila e a tela volta na hora, com o registro já visível (story 171).
    const backToList = (successMsg: string) =>
      router.replace({
        pathname: '/(app)/street-sales',
        params: { successMsg },
      } as never);

    submit(
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
        onSent: () => backToList('Faturamento registrado com sucesso.'),
        onQueued: () =>
          backToList('Faturamento salvo. Será enviado quando a conexão voltar.'),
        onFailed: () =>
          notify('Erro', 'Não foi possível registrar o faturamento.'),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5">
        <StreetSaleFormFields control={control} errors={errors} totalAmount={totalAmount} />

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
  );
}
