import type { ObservabilityRouteStats } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  N_PLUS_ONE_QUERIES_THRESHOLD,
  OTHER_ROUTE,
  OTHER_ROUTE_LABEL,
  SLOW_P95_MS_THRESHOLD,
} from '../constants';
import { formatMs, formatNumber, isNPlusOneSuspect, isSlowRoute } from '../utils';

interface Props {
  route: ObservabilityRouteStats;
}

/** Uma rota do agregado. Item extraído: a tabela não renderiza linha inline. */
export function RouteCostRow({ route }: Props) {
  const isOther = route.route === OTHER_ROUTE;
  const nPlusOne = isNPlusOneSuspect(route);
  const slow = isSlowRoute(route);
  const hasErrors = route.errors > 0;

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        <span>{route.route}</span>
        {isOther && (
          <span className="ml-2 font-sans text-xs text-muted-foreground">
            {OTHER_ROUTE_LABEL}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{route.count}</TableCell>
      <TableCell
        className={cn(
          'text-right tabular-nums',
          hasErrors && 'font-semibold text-destructive',
        )}
      >
        {route.errors}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMs(route.p50DurationMs)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className={cn(slow && 'font-semibold text-destructive')}>
          {formatMs(route.p95DurationMs)}
        </span>
        {slow && (
          <Badge
            variant="destructive"
            className="ml-2"
            title={`p95 acima de ${SLOW_P95_MS_THRESHOLD} ms`}
          >
            lento
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMs(route.maxDurationMs)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMs(route.avgCpuMs)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className={cn(nPlusOne && 'font-semibold text-destructive')}>
          {formatNumber(route.avgDbQueries)}
        </span>
        {nPlusOne && (
          <Badge
            variant="destructive"
            className="ml-2"
            title={`Média acima de ${N_PLUS_ONE_QUERIES_THRESHOLD} queries por requisição`}
          >
            N+1?
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMs(route.avgDbMs)}
      </TableCell>
    </TableRow>
  );
}
