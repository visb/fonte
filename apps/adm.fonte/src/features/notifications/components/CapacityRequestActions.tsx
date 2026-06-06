import { Check, X } from 'lucide-react';
import {
  HouseCapacityRequestStatus,
  type Notification,
} from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/lib/errors';
import {
  useApproveCapacityRequest,
  useRejectCapacityRequest,
  useCapacityRequest,
} from '@/features/houses/hooks/useHouses';
import { CAPACITY_STATUS_CONFIG } from '@/features/houses/components/tabs/CapacityRequestRow';
import { useMarkNotificationRead } from '../hooks/useNotifications';

interface Props {
  notification: Notification;
}

/** Botões Aprovar/Rejeitar embutidos no item de notificação de pedido de leitos. */
export function CapacityRequestActions({ notification }: Props) {
  const meta = (notification.metadata ?? {}) as Record<string, unknown>;
  const requestId = typeof meta.requestId === 'string' ? meta.requestId : null;

  const approve = useApproveCapacityRequest();
  const reject = useRejectCapacityRequest();
  const markRead = useMarkNotificationRead();
  // Estado autoritativo do pedido — reflete aprovação/rejeição feita em qualquer sessão.
  const { data: request } = useCapacityRequest(requestId);

  if (!requestId) return null;

  const general = num(meta.requestedGeneralCapacity);
  const staff = num(meta.requestedStaffCapacity);
  const prevGeneral = num(meta.previousGeneralCapacity);
  const prevStaff = num(meta.previousStaffCapacity);
  const status = request?.status ?? HouseCapacityRequestStatus.PENDING;
  const isPending = status === HouseCapacityRequestStatus.PENDING;
  const busy = approve.isPending || reject.isPending;
  const error = approve.error || reject.error;

  async function handle(action: 'approve' | 'reject') {
    try {
      if (action === 'approve') await approve.mutateAsync(requestId!);
      else await reject.mutateAsync(requestId!);
      if (!notification.read) markRead.mutate(notification.id);
    } catch {
      // erro exibido abaixo via approve.error/reject.error
    }
  }

  return (
    <div className="px-3 pb-2.5">
      <div className="rounded-md border bg-background p-2 text-xs">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>
            Filhos: <b className="text-foreground">{general ?? '—'}</b>
            {prevGeneral != null && ` (era ${prevGeneral})`}
          </span>
          <span>
            Servos: <b className="text-foreground">{staff ?? '—'}</b>
            {prevStaff != null && ` (era ${prevStaff})`}
          </span>
        </div>

        {isPending ? (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              className="h-7 flex-1 gap-1"
              disabled={busy}
              onClick={() => handle('approve')}
            >
              <Check size={13} /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 gap-1"
              disabled={busy}
              onClick={() => handle('reject')}
            >
              <X size={13} /> Rejeitar
            </Button>
          </div>
        ) : (
          <div className="mt-2">
            <Badge variant={CAPACITY_STATUS_CONFIG[status].variant}>
              {CAPACITY_STATUS_CONFIG[status].label}
            </Badge>
          </div>
        )}

        {error && (
          <p className="mt-1.5 text-destructive">
            {getErrorMessage(error, 'Erro ao processar pedido.')}
          </p>
        )}
      </div>
    </div>
  );
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
