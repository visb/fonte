import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useAuditEvents } from '../hooks/useAudit';
import { AuditFilters } from '../components/AuditFilters';
import { AuditEventTable } from '../components/AuditEventTable';
import { AuditEventDetailDialog } from '../components/AuditEventDetailDialog';
import { toApiFilters, type AuditFiltersForm, EMPTY_AUDIT_FILTERS } from '../utils';

/**
 * Story 199 — trilha de auditoria (ADMIN). Mais recentes primeiro; filtros da
 * API, "carregar mais" por cursor e detalhe com antes/depois. Sem fetch aqui:
 * a página só orquestra hook e componentes.
 */
export function AuditPage() {
  const [filters, setFilters] = useState<AuditFiltersForm>(EMPTY_AUDIT_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useAuditEvents(toApiFilters(filters));
  const events = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Quem fez cada alteração, quando e o que mudou."
        actions={
          <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw size={14} className="mr-1.5" />
            Atualizar
          </Button>
        }
      />

      <AuditFilters onApply={setFilters} />

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          message={getErrorMessage(query.error, 'Erro ao carregar a auditoria.')}
          onRetry={() => query.refetch()}
        />
      ) : events.length === 0 ? (
        <EmptyState
          title="Nenhum evento encontrado."
          description="Sem filtro de período, a busca cobre os últimos 30 dias."
        />
      ) : (
        <AuditEventTable
          events={events}
          hasMore={!!query.hasNextPage}
          loadingMore={query.isFetchingNextPage}
          onLoadMore={() => query.fetchNextPage()}
          onOpen={setOpenId}
        />
      )}

      <AuditEventDetailDialog eventId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
