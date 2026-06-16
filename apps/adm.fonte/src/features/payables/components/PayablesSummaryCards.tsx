import type { PayablesSummary } from '@fonte/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '../lib/money';

interface Props {
  summary: PayablesSummary;
}

interface CardData {
  label: string;
  total: number;
  count: number;
  className: string;
}

export function PayablesSummaryCards({ summary }: Props) {
  const cards: CardData[] = [
    {
      label: 'A pagar (em aberto)',
      total: summary.totalOpen,
      count: summary.countOpen,
      className: 'text-amber-600',
    },
    {
      label: 'Vencidas',
      total: summary.totalOverdue,
      count: summary.countOverdue,
      className: 'text-destructive',
    },
    {
      label: 'Pagas',
      total: summary.totalPaid,
      count: summary.countPaid,
      className: 'text-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${c.className}`}>{formatCents(c.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {c.count} {c.count === 1 ? 'conta' : 'contas'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
