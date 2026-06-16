import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AssociatesOverviewCurrent } from '@fonte/api-client';
import { formatBRL } from '../lib/format';

interface Props {
  current: AssociatesOverviewCurrent;
}

interface Kpi {
  title: string;
  gross: number;
  net: number;
}

/** Cards de esperado × arrecadado (bruto e líquido) do mês corrente. */
export function OverviewKpiCards({ current }: Props) {
  const kpis: Kpi[] = [
    { title: 'Esperado no mês', gross: current.expectedGross, net: current.expectedNet },
    { title: 'Arrecadado no mês', gross: current.collectedGross, net: current.collectedNet },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(kpi.gross)}</p>
            <p className="text-xs text-muted-foreground">bruto (cobrado do associado)</p>
            <p className="mt-2 text-lg font-semibold">{formatBRL(kpi.net)}</p>
            <p className="text-xs text-muted-foreground">líquido (recebido pela Fonte)</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
