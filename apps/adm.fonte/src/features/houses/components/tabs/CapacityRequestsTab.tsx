import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useCapacityRequestHistory } from '../../hooks/useHouses';
import { CapacityRequestRow } from './CapacityRequestRow';

export function CapacityRequestsTab({ houseId }: { houseId: string }) {
  const { data: requests = [], isLoading, error, refetch } = useCapacityRequestHistory(houseId);

  if (isLoading) return <LoadingState />;
  if (error) {
    return (
      <ErrorState
        message={getErrorMessage(error, 'Erro ao carregar pedidos.')}
        onRetry={refetch}
      />
    );
  }
  if (requests.length === 0) {
    return <EmptyState title="Nenhum pedido de alteração de leitos." />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Aprove ou rejeite pelos avisos no sino de notificações. Histórico de todos os pedidos:
      </p>
      {requests.map((request) => (
        <CapacityRequestRow key={request.id} request={request} />
      ))}
    </div>
  );
}
