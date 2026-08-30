import type { ObservabilityRecentRequest } from '@fonte/api-client';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { RECENT_REQUEST_COLUMNS } from '../constants';
import { RecentRequestRow } from './RecentRequestRow';

interface Props {
  requests: ObservabilityRecentRequest[];
}

/**
 * Últimas requisições, mais recente primeiro (a ordem vem do backend). Sem
 * paginação: o ring buffer já é limitado na API.
 */
export function RecentRequestsTable({ requests }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {RECENT_REQUEST_COLUMNS.map((label, index) => (
            <TableHead
              key={label}
              className={cn('whitespace-nowrap', index >= 3 && 'text-right')}
            >
              {label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => (
          <RecentRequestRow key={request.requestId} request={request} />
        ))}
      </TableBody>
    </Table>
  );
}
