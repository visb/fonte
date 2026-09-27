import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useProductContributionForm } from '../hooks/useProductContributionForm';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  useInventoryCatalog,
  useResidentReceivables,
  useResidentProductContributions,
} from '../hooks/useProductContributions';
import {
  emptyProductLine,
} from '../lib/productContributions';
import { currentReceivable, formatReferenceMonth } from '../lib/receivables';
import { ProductContributionRow } from '../components/ProductContributionRow';
import { ProductContributionList } from '../components/ProductContributionList';

export function DeclareProductContributionPage() {
  const { residentId, houseId, returnTo } = useLocalSearchParams<{ residentId: string; houseId: string; returnTo?: string }>();

  const {
    data: receivables,
    isLoading: loadingReceivables,
    isError: receivablesError,
    refetch: refetchReceivables,
  } = useResidentReceivables(residentId);
  const { data: catalog = [], isLoading: catalogLoading } = useInventoryCatalog(houseId);

  const receivable = receivables ? currentReceivable(receivables) : null;

  const { data: declared = [] } = useResidentProductContributions(residentId, receivable?.id, {
    enabled: !!receivable,
  });
  const { control, setValue, formState: { errors }, fields, append, remove, onSubmit, isPending } =
    useProductContributionForm(residentId!, houseId!, receivable, returnTo);

  if (loadingReceivables) {
    return (
      <>
        <Stack.Screen options={{ title: 'Declarar produtos' }} />
        <LoadingState />
      </>
    );
  }

  if (receivablesError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Declarar produtos' }} />
        <ErrorState message="Erro ao carregar o carnê do filho." onRetry={refetchReceivables} />
      </>
    );
  }

  if (!receivable) {
    return (
      <>
        <Stack.Screen options={{ title: 'Declarar produtos' }} />
        <EmptyState message="Nenhuma parcela disponível para declarar contribuição." />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Declarar produtos' }} />
      <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
        <View className="px-4 py-5">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Parcela
          </Text>
          <Text className="text-base text-gray-900 mb-4">
            {formatReferenceMonth(receivable.referenceMonth)}
          </Text>

          {fields.map((field, index) => (
            <ProductContributionRow
              key={field.id}
              index={index}
              control={control}
              setValue={setValue}
              catalog={catalog}
              catalogLoading={catalogLoading}
              errors={errors.products?.[index]}
              onRemove={() => (fields.length > 1 ? remove(index) : undefined)}
            />
          ))}

          <TouchableOpacity
            accessibilityLabel="Adicionar produto"
            className="border border-dashed border-blue-400 rounded-lg py-3 items-center mb-4"
            onPress={() => append(emptyProductLine())}
          >
            <Text className="text-sm text-blue-600 font-medium">+ Adicionar produto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-600 rounded-lg py-3.5 items-center"
            onPress={onSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Declarar contribuição</Text>
            )}
          </TouchableOpacity>

          <ProductContributionList contributions={declared} catalog={catalog} />
        </View>
      </ScrollView>
    </>
  );
}
