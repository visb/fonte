import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useAssociateById } from '../hooks/useAssociates';
import { AssociateStatusBadge } from './AssociateStatusBadge';
import { ChargeRow } from './ChargeRow';
import { formatBRL, formatDate } from '../lib/format';

interface Props {
  associateId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AssociateDetailDialog({ associateId, open, onClose }: Props) {
  const { data, isLoading, error, refetch } = useAssociateById(associateId, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.name ?? 'Detalhe do associado'}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            message={getErrorMessage(error, 'Erro ao carregar o associado.')}
            onRetry={refetch}
          />
        ) : data ? (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Data de adesão</dt>
                <dd className="font-medium">{formatDate(data.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-0.5">
                  <AssociateStatusBadge status={data.status} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contribuição</dt>
                <dd className="font-medium">{formatBRL(data.contributionAmount)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dia de vencimento</dt>
                <dd className="font-medium">Dia {data.dueDay}</dd>
              </div>
            </dl>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Histórico de contribuições</h3>
              {data.charges.length === 0 ? (
                <EmptyState title="Nenhuma cobrança registrada." />
              ) : (
                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pago em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.charges.map((charge) => (
                        <ChargeRow key={charge.id} charge={charge} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
