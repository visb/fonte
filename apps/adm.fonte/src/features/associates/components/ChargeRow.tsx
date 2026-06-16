import type { AssociateCharge } from '@fonte/api-client';
import { TableCell, TableRow } from '@/components/ui/table';
import { ChargeStatusBadge } from './ChargeStatusBadge';
import { formatBRL, formatDate } from '../lib/format';

export function ChargeRow({ charge }: { charge: AssociateCharge }) {
  return (
    <TableRow>
      <TableCell>{formatDate(charge.dueDate)}</TableCell>
      <TableCell>{formatBRL(charge.grossAmount)}</TableCell>
      <TableCell>
        <ChargeStatusBadge status={charge.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(charge.paidAt)}</TableCell>
    </TableRow>
  );
}
