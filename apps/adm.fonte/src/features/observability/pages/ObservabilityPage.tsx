import { Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useObservabilityStats,
  useResetObservability,
} from '../hooks/useObservability';
import { RuntimeCards } from '../components/RuntimeCards';
import { RouteCostTable } from '../components/RouteCostTable';
import { RecentRequestsTable } from '../components/RecentRequestsTable';
import { VOLATILE_DATA_NOTICE } from '../constants';
import { formatDateTime } from '../utils';

const sentryOrgUrl = import.meta.env.VITE_SENTRY_ORG_URL as string | undefined;

/**
 * Janela viva do processo da API (story 192). Não é dashboard histórico: os
 * números morrem no restart, por desenho da story 191.
 */
export function ObservabilityPage() {
  const { data, isLoading, isError, error, refetch } = useObservabilityStats();
  const resetMutation = useResetObservability();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Observabilidade"
        description="Saúde do processo da API e custo por requisição, agora."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw size={14} className="mr-1.5" />
            {resetMutation.isPending ? 'Zerando…' : 'Zerar contadores'}
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          {VOLATILE_DATA_NOTICE}
          {data?.startedAt && (
            <>
              {' '}
              <span className="font-medium text-foreground">
                Agregado desde {formatDateTime(data.startedAt)}.
              </span>
            </>
          )}
        </p>
      </div>

      {resetMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {getErrorMessage(resetMutation.error, 'Falha ao zerar os contadores.')}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState
          message={getErrorMessage(error, 'Erro ao carregar a observabilidade.')}
          onRetry={() => refetch()}
        />
      ) : !data ? (
        <EmptyState title="Nenhum dado de observabilidade." />
      ) : (
        <div className="space-y-8">
          <RuntimeCards runtime={data.runtime} />

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Custo por rota</h2>
            {data.routes.length === 0 ? (
              <EmptyState
                title="Nenhuma rota registrada ainda."
                description="Os contadores começam do zero a cada restart da API."
              />
            ) : (
              <RouteCostTable routes={data.routes} />
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Últimas requisições</h2>
            {data.recent.length === 0 ? (
              <EmptyState title="Nenhuma requisição registrada ainda." />
            ) : (
              <RecentRequestsTable requests={data.recent} />
            )}
          </section>
        </div>
      )}

      {sentryOrgUrl && (
        <p className="text-xs text-muted-foreground">
          Histórico, p95 por transação e alertas:{' '}
          <a
            href={sentryOrgUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            projeto no Sentry
          </a>
          .
        </p>
      )}
    </div>
  );
}
