import {
  HouseCapacityRequestStatus,
  type HouseCapacityRequest,
} from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';

export const CAPACITY_STATUS_CONFIG: Record<
  HouseCapacityRequestStatus,
  { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }
> = {
  [HouseCapacityRequestStatus.PENDING]: { label: 'Pendente', variant: 'warning' },
  [HouseCapacityRequestStatus.APPROVED]: { label: 'Aprovado', variant: 'success' },
  [HouseCapacityRequestStatus.REJECTED]: { label: 'Rejeitado', variant: 'destructive' },
  [HouseCapacityRequestStatus.SUPERSEDED]: { label: 'Substituído', variant: 'secondary' },
};

export function CapacityRequestRow({ request }: { request: HouseCapacityRequest }) {
  const status = CAPACITY_STATUS_CONFIG[request.status];

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">
          {request.requestedGeneralCapacity} leitos (filhos) ·{' '}
          {request.requestedStaffCapacity} leitos (servos)
        </p>
        <Badge variant={status.variant} className="shrink-0">
          {status.label}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Anterior: {request.previousGeneralCapacity ?? '—'} / {request.previousStaffCapacity ?? '—'}
      </p>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{request.requestedBy?.name ?? 'Coordenador'}</span>
        <span>{new Date(request.createdAt).toLocaleString('pt-BR')}</span>
      </div>
    </div>
  );
}
