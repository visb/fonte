import type { AuditEventSummary } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { actionLabel, OUTCOME_LABELS, reasonLabel, ROLE_LABELS, targetTypeLabel } from '../constants';
import { formatDateTime, shortId } from '../utils';

interface Props {
  event: AuditEventSummary;
  onOpen: (id: string) => void;
}

/** Autor legível; tentativa de login sem identidade aparece como tal. */
function authorOf(event: AuditEventSummary): string {
  if (event.userName) return event.userName;
  if (event.userId) return shortId(event.userId);
  return event.action === 'auth.login' ? 'Tentativa não autenticada' : 'Sistema';
}

function houseOf(event: AuditEventSummary): string {
  const current = event.houseName ?? (event.houseId ? shortId(event.houseId) : '—');
  if (!event.previousHouseId) return current;
  const previous = event.previousHouseName ?? shortId(event.previousHouseId);
  return `${previous} → ${current}`;
}

export function AuditEventRow({ event, onOpen }: Props) {
  const failed = event.outcome === 'FAILURE';
  const reason = reasonLabel(event.reason);
  return (
    <TableRow
      className="cursor-pointer"
      data-testid="audit-row"
      onClick={() => onOpen(event.id)}
    >
      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(event.createdAt)}</TableCell>
      <TableCell>
        <p className="text-sm">{authorOf(event)}</p>
        {event.role && <p className="text-xs text-muted-foreground">{ROLE_LABELS[event.role] ?? event.role}</p>}
      </TableCell>
      <TableCell>
        <p className="text-sm font-medium">{actionLabel(event.action)}</p>
        {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      </TableCell>
      <TableCell>
        <p className="text-xs text-muted-foreground">{targetTypeLabel(event.targetType)}</p>
        <p className="text-sm">{event.targetName ?? shortId(event.targetId)}</p>
      </TableCell>
      <TableCell className="text-sm">{houseOf(event)}</TableCell>
      <TableCell>
        {event.outcome ? (
          <Badge variant={failed ? 'destructive' : 'success'}>{OUTCOME_LABELS[event.outcome]}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
