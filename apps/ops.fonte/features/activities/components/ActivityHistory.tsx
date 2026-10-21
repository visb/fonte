import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHouseStaff } from '@/features/staff/hooks/useHouseStaff';
import { useActivityEvents } from '@/features/activities/hooks/useActivities';
import { ActivityHistoryItem } from './ActivityHistoryItem';

interface Props {
  activityId: string;
  /** Casa da atividade: resolve o nome dos servos citados na trilha. */
  houseId: string | null | undefined;
}

/**
 * Aba Histórico do detalhe (story 220): a trilha gravada pelo backend (story 66),
 * do mais recente para o mais antigo. Nomes de responsável vêm da lista de servos
 * da casa (cacheada offline, story 204); id fora dela vira "servo removido".
 */
export function ActivityHistory({ activityId, houseId }: Props) {
  const { data: events, isLoading, error, refetch } = useActivityEvents(activityId);
  const { data: staff = [] } = useHouseStaff(houseId);

  const names = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff]);
  const resolveStaffName = useCallback((id: string) => names.get(id), [names]);

  if (isLoading) return <LoadingState />;
  if (error) {
    return <ErrorState message="Erro ao carregar o histórico." onRetry={refetch} />;
  }
  if (!events || events.length === 0) {
    return <EmptyState message="Nenhum registro no histórico." />;
  }

  return (
    <View testID="activity-history">
      {events.map((event) => (
        <ActivityHistoryItem
          key={event.id}
          event={event}
          resolveStaffName={resolveStaffName}
        />
      ))}
    </View>
  );
}
