import { View, Text, FlatList } from 'react-native';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PaidReceivableRow } from '../components/PaidReceivableRow';
import { useMyPaidReceivables, useReceivableReceipt } from '../hooks/useContributions';

/**
 * Story 193 — contribuições do familiar: o que já foi PAGO, com o recibo de
 * cada parcela. Nada de pendente/vencido (decisão 11) — cobrar pelo app do
 * familiar é decisão de produto que ninguém tomou.
 */
export function ContributionsPage() {
  const { relative } = useAuth();
  const { data: items = [], isLoading, isError, refetch } = useMyPaidReceivables();
  const receipt = useReceivableReceipt();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-4 border-b border-gray-100 bg-white">
        <Text className="text-base font-semibold text-gray-900">
          Contribuições de {relative?.residentName}
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          Baixe o recibo de cada contribuição já paga
        </Text>
      </View>

      {receipt.error && (
        <Text className="text-sm text-red-600 px-4 pt-3">{receipt.error}</Text>
      )}

      {items.length === 0 ? (
        <EmptyState message="Nenhuma contribuição registrada ainda." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => (
            <PaidReceivableRow
              receivable={item}
              onDownloadReceipt={(id) => void receipt.download(id)}
              isDownloading={receipt.downloadingId === item.id}
            />
          )}
        />
      )}
    </View>
  );
}
