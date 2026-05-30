import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StreetSalesReportResponse } from '@fonte/api-client';

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const abs = Math.abs(pct).toFixed(1);

  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
        <TrendingUp size={12} /> +{abs}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-500">
        <TrendingDown size={12} /> -{abs}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
      <Minus size={12} /> 0%
    </span>
  );
}

interface Props {
  data: StreetSalesReportResponse;
}

export function SalesSummaryCards({ data }: Props) {
  const currentTotals = data.byHouse.reduce(
    (acc, h) => ({
      pix: acc.pix + h.totalPix,
      cash: acc.cash + h.totalCash,
      card: acc.card + h.totalCard,
      qty: acc.qty + h.totalQuantity,
    }),
    { pix: 0, cash: 0, card: 0, qty: 0 },
  );

  const cards = [
    { title: 'Total Arrecadado', value: formatBRL(data.currentPeriodTotal), showTrend: true },
    { title: 'PIX', value: formatBRL(currentTotals.pix) },
    { title: 'Dinheiro', value: formatBRL(currentTotals.cash) },
    { title: 'Cartão', value: formatBRL(currentTotals.card) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{card.value}</p>
            {card.showTrend && (
              <div className="mt-1">
                <TrendBadge current={data.currentPeriodTotal} previous={data.previousPeriodTotal} />
                {data.previousPeriodTotal > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">vs mês anterior</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
