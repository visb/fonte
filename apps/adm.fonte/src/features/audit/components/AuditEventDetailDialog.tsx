import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useAuditEvent } from '../hooks/useAudit';
import { actionLabel, LEGACY_DETAIL_MESSAGE, NO_DIFF_MESSAGE } from '../constants';
import { formatDateTime } from '../utils';
import { AuditChangesTable } from './AuditChangesTable';
import { AuditContextList } from './AuditContextList';
import { AuditEventMeta } from './AuditEventMeta';

interface Props {
  eventId: string | null;
  onClose: () => void;
}

/** Detalhe autossuficiente: busca o próprio evento quando abre. */
export function AuditEventDetailDialog({ eventId, onClose }: Props) {
  const open = !!eventId;
  const { data, isLoading, isError, error, refetch } = useAuditEvent(eventId, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data ? actionLabel(data.action) : 'Evento de auditoria'}</DialogTitle>
          <DialogDescription>{data ? formatDateTime(data.createdAt) : ' '}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState
            message={getErrorMessage(error, 'Erro ao carregar o evento.')}
            onRetry={() => refetch()}
          />
        ) : data ? (
          <div className="space-y-4">
            <AuditEventMeta event={data} onNavigate={onClose} />
            {!data.hasDetail ? (
              <p className="text-sm text-muted-foreground">{LEGACY_DETAIL_MESSAGE}</p>
            ) : data.changes && data.changes.length > 0 ? (
              <AuditChangesTable changes={data.changes} />
            ) : (
              <p className="text-sm text-muted-foreground">{NO_DIFF_MESSAGE}</p>
            )}
            {data.context && <AuditContextList context={data.context} />}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
