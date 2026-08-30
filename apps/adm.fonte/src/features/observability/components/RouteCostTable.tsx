import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ObservabilityRouteStats } from '@fonte/api-client';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ROUTE_COST_COLUMNS, type RouteSortKey } from '../constants';
import { sortRoutes } from '../utils';
import { RouteCostRow } from './RouteCostRow';

interface Props {
  routes: ObservabilityRouteStats[];
}

/**
 * Custo por rota desde o início da janela. Ordenação default: p95 desc — a
 * primeira pergunta é sempre "o que está lento".
 *
 * O `useState` daqui é estado de UI (ordenação), não campo de formulário: a
 * proibição de `useState` do CLAUDE.md é sobre formulário.
 */
export function RouteCostTable({ routes }: Props) {
  const [sortKey, setSortKey] = useState<RouteSortKey>('p95DurationMs');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: RouteSortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setDirection('desc');
  }

  const sorted = sortRoutes(routes, sortKey, direction);
  const SortIcon = direction === 'desc' ? ArrowDown : ArrowUp;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {ROUTE_COST_COLUMNS.map((column) => {
            const active = column.sortKey === sortKey;
            return (
              <TableHead
                key={column.key}
                title={column.hint}
                className={cn(
                  'whitespace-nowrap',
                  column.key !== 'route' && 'text-right',
                )}
              >
                {column.sortKey ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.sortKey as RouteSortKey)}
                    aria-label={`Ordenar por ${column.label}`}
                    className={cn(
                      'inline-flex items-center gap-1 hover:text-foreground',
                      active && 'font-semibold text-foreground',
                    )}
                  >
                    {column.label}
                    {active && <SortIcon size={12} aria-hidden="true" />}
                  </button>
                ) : (
                  column.label
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((route) => (
          <RouteCostRow key={route.route} route={route} />
        ))}
      </TableBody>
    </Table>
  );
}
