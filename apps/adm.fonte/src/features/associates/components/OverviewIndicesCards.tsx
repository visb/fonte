import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AssociatesOverviewCurrent } from '@fonte/api-client';
import { formatPercent } from '../lib/format';

interface Props {
  current: AssociatesOverviewCurrent;
}

interface Index {
  title: string;
  value: string;
  hint?: string;
}

/** Índices do mês: novos associados, recorrência/ativos, churn, inadimplência. */
export function OverviewIndicesCards({ current }: Props) {
  const indices: Index[] = [
    {
      title: 'Novos associados',
      value: String(current.newAssociates),
      hint: 'criados no mês',
    },
    {
      title: 'Ativos / recorrência',
      value: String(current.activeSubscriptions),
      hint: `${formatPercent(current.recurrenceRate)} dos não-cancelados`,
    },
    {
      title: 'Churn',
      value: String(current.churnCount),
      hint: `${formatPercent(current.churnRate)} no mês`,
    },
    {
      title: 'Inadimplência',
      value: String(current.delinquentCharges),
      hint: `${current.pastDueAssociates} associado(s) em atraso`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {indices.map((index) => (
        <Card key={index.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{index.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{index.value}</p>
            {index.hint && <p className="text-xs text-muted-foreground mt-1">{index.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
