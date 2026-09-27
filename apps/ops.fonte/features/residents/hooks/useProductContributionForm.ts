import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { getErrorMessage } from '@/lib/errors';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { useDeclareProductContribution } from './useProductContributions';
import { emptyProductLine, productContributionFormSchema, toContributionLines, type ProductContributionFormValues } from '../lib/productContributions';

export function useProductContributionForm(residentId: string, houseId: string,
  receivable: { id: string; referenceMonth: string } | null, returnTo?: string) {
  const mutation = useDeclareProductContribution();
  const submit = useFieldSubmit(mutation);
  const form = useForm<ProductContributionFormValues>({
    resolver: zodResolver(productContributionFormSchema), defaultValues: { products: [emptyProductLine()] },
  });
  const fields = useFieldArray({ control: form.control, name: 'products' });
  const leave = (message: string) => {
    if (returnTo === 'contributions') {
      router.replace({ pathname: '/(app)/contributions', params: { successMsg: message } } as never);
    } else {
      Alert.alert('Contribuição em produtos', message);
      router.back();
    }
  };
  const onSubmit = form.handleSubmit((data) => {
    if (!receivable) return;
    submit({ residentId, houseId, receivableId: receivable.id,
      referenceMonth: `${receivable.referenceMonth.slice(0, 7)}-01`, lines: toContributionLines(data.products) }, {
      onSent: () => leave('Contribuição em produtos declarada.'),
      onQueued: () => leave('Contribuição salva no aparelho. Aguardando envio.'),
      onFailed: (error) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível declarar a contribuição.')),
    });
  });
  return { ...form, ...fields, onSubmit, isPending: mutation.isPending };
}
