import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StreetSalesReportResponse } from '@fonte/api-client';

type View = 'weekly' | 'monthly';

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPeriodLabel(period: string, view: View): string {
  if (view === 'monthly') {
    const [y, m] = period.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
  }
  const [, m, d] = period.split('-');
  return `${d}/${m}`;
}

interface Props {
  data: StreetSalesReportResponse;
}

export function SalesHistoryChart({ data }: Props) {
  const [view, setView] = useState<View>('weekly');

  const periods = view === 'weekly' ? data.weeklyTotals : data.monthlyTotals;

  const chartData = periods.map((p) => ({
    period: formatPeriodLabel(p.period, view),
    PIX: p.totalPix / 100,
    Dinheiro: p.totalCash / 100,
    Cartão: p.totalCard / 100,
  }));

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Histórico</CardTitle>
        <div className="flex gap-2">
          {(['weekly', 'monthly'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                view === v
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {v === 'weekly' ? 'Semanas' : 'Meses'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `R$${v.toLocaleString('pt-BR')}`}
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip
                formatter={(value: number) => formatBRL(value * 100)}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="PIX" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Dinheiro" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Cartão" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
