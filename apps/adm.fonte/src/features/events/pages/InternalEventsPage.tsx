import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useInternalEvents } from '../hooks/useEvents';
import { InternalEventCard } from '../components/InternalEventCard';

/**
 * Lista só-leitura de eventos internos (story 94), visível a todos os papéis de
 * Staff. Eventos internos são avisos/agenda para os servos; a gestão (criar/
 * editar) continua na página de Eventos (ADMIN + COORDINATOR).
 */
export function InternalEventsPage() {
  const { data: events, isLoading, error, refetch } = useInternalEvents();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos internos"
        description="Próximos eventos voltados aos servos. Apenas leitura."
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={getErrorMessage(error, 'Erro ao carregar eventos internos.')}
          onRetry={refetch}
        />
      ) : !events || events.length === 0 ? (
        <EmptyState title="Nenhum evento interno agendado." />
      ) : (
        <div className="space-y-3" data-testid="internal-events-list">
          {events.map((event) => (
            <InternalEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
