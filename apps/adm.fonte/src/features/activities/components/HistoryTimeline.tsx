import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { getErrorMessage } from '@/lib/errors';
import { useActivityEvents } from '../hooks/useActivities';
import { HistoryEventItem } from './HistoryEventItem';

/**
 * Aba Histórico (story 66): trilha de auditoria só-leitura da atividade, em ordem
 * cronológica decrescente (mais recente primeiro), montada pelo backend.
 */
export function HistoryTimeline({ activityId }: { activityId: string }) {
  const { data: events, isLoading, error, refetch } = useActivityEvents(activityId);

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <ErrorState
        message={getErrorMessage(error, 'Erro ao carregar o histórico.')}
        onRetry={refetch}
      />
    );
  }

  if (!events || events.length === 0) {
    return <EmptyState title="Nenhum evento registrado ainda." />;
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <HistoryEventItem key={event.id} event={event} />
      ))}
    </ul>
  );
}
