import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import type { StreetSale } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialogs';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
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
  const submit = useFieldSubmit(mutation);
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
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

  const [amountPix, amountCash, amountCard] = useWatch({
    control,
    name: ['amountPix', 'amountCash', 'amountCard'],
  });

  const totalAmount = String(
    parseFloat((amountPix || '0').replace(',', '.') || '0') +
    parseFloat((amountCash || '0').replace(',', '.') || '0') +
    parseFloat((amountCard || '0').replace(',', '.') || '0'),
  );

  const onSubmit = (data: FormData) => {
    submit(
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
        onSent: () =>
          notify('Sucesso', 'Registro atualizado.', () => router.back()),
        // Sem sinal a edição fica na fila (story 171): a tela volta na hora em
        // vez de travar esperando um `onSuccess` que só chega com rede.
        onQueued: () => {
          router.back();
          notify(
            'Salvo no aparelho',
            'Sem conexão agora: a alteração será enviada assim que a conexão voltar.',
          );
        },
        onFailed: () =>
          notify('Erro', 'Não foi possível atualizar o registro.'),
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
            <Text className="text-white font-semibold text-base">Salvar alterações</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
