import { useState } from 'react';
import { SectionList, View } from 'react-native';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/LoadingState';
import { SyncItemCard } from '../components/SyncItemCard';
import { SyncLogoutNotice } from '../components/SyncLogoutNotice';
import { SyncSection } from '../components/SyncSection';
import { DiscardItemDialog } from '../components/DiscardItemDialog';
import { SYNC_SECTION_DESCRIPTIONS, SYNC_SECTION_TITLES } from '../constants';
import { useRetryFailed, useSyncQueue, type SyncQueueItem } from '../hooks/useSyncQueue';

interface SyncSectionData {
  title: string;
  description: string;
  /** As duas origens convivem numa `SectionList` só (sem lista aninhada). */
  data: SyncQueueItem[];
}

/**
 * Pendências de sincronização (story 170). Só orquestra: as duas seções vêm do
 * `useSyncQueue`, o descarte mora no dialog e o banner de offline vem do layout
 * (story 168).
 */
export function SyncPage() {
  const { pending, failed, total, isLoading, error } = useSyncQueue();
  const retry = useRetryFailed();
  const [itemToDiscard, setItemToDiscard] = useState<SyncQueueItem | null>(null);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Não foi possível ler a fila de sincronização." />;

  // Seção sem item não aparece: lista vazia com cabeçalho só faz ruído.
  const sections: SyncSectionData[] = [
    {
      title: SYNC_SECTION_TITLES.failed,
      description: SYNC_SECTION_DESCRIPTIONS.failed,
      data: failed,
    },
    {
      title: SYNC_SECTION_TITLES.pending,
      description: SYNC_SECTION_DESCRIPTIONS.pending,
      data: pending,
    },
  ].filter((section) => section.data.length > 0);

  return (
    <View className="flex-1 bg-gray-50">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        contentContainerStyle={total === 0 ? { flexGrow: 1 } : undefined}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={total > 0 ? <SyncLogoutNotice /> : null}
        ListEmptyComponent={
          <EmptyState message="Nada pendente. Todos os lançamentos já foram enviados." />
        }
        renderSectionHeader={({ section }) => (
          <SyncSection
            title={section.title}
            description={section.description}
            count={section.data.length}
          />
        )}
        renderItem={({ item }) => {
          // Const narrowing: só item recusado tem o que reenviar (decisão 3).
          const failed = item.status === 'failed' ? item : null;
          return (
            <SyncItemCard
              item={item}
              onRetry={failed ? () => retry.mutate(failed) : undefined}
              onDiscard={setItemToDiscard}
              isRetrying={retry.isPending}
            />
          );
        }}
      />

      <DiscardItemDialog item={itemToDiscard} onClose={() => setItemToDiscard(null)} />
    </View>
  );
}
