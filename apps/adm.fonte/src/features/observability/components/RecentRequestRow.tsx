import type { ObservabilityRecentRequest } from '@fonte/api-client';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatMs, formatNumber, formatTime, isErrorStatus } from '../utils';

interface Props {
  request: ObservabilityRecentRequest;
}

/** Uma requisição do ring buffer. Sem dado pessoal — só rota, status e números. */
export function RecentRequestRow({ request }: Props) {
  const failed = isErrorStatus(request.status);

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap tabular-nums">
        {formatTime(request.at)}
      </TableCell>
      <TableCell className="font-mono text-xs">{request.method}</TableCell>
      <TableCell className="font-mono text-xs">{request.route}</TableCell>
      <TableCell
        className={cn(
          'text-right tabular-nums',
          failed && 'font-semibold text-destructive',
        )}
      >
        {request.status}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMs(request.durationMs)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMs(request.cpuMs)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatNumber(request.dbQueries, 0)}
      </TableCell>
    </TableRow>
  );
}
