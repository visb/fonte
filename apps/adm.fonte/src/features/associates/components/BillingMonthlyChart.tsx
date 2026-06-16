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
import type { AssociatesOverviewMonth } from '@fonte/api-client';
import { formatBRL, formatMonthLabel } from '../lib/format';

type View = 'gross' | 'net';

interface Props {
  months: AssociatesOverviewMonth[];
}

/** Esperado × arrecadado por mês (barras), alternando bruto/líquido. */
export function BillingMonthlyChart({ months }: Props) {
  const [view, setView] = useState<View>('gross');

  const chartData = months.map((m) => ({
    period: formatMonthLabel(m.month),
    Esperado: view === 'gross' ? m.expectedGross : m.expectedNet,
    Arrecadado: view === 'gross' ? m.collectedGross : m.collectedNet,
  }));

  const hasData = months.some(
    (m) => m.expectedGross || m.expectedNet || m.collectedGross || m.collectedNet,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Esperado × Arrecadado</CardTitle>
        <div className="flex gap-2">
          {(['gross', 'net'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                view === v
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {v === 'gross' ? 'Bruto' : 'Líquido'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `R$${v.toLocaleString('pt-BR')}`}
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip
                formatter={(value) => formatBRL(Number(value))}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Esperado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Arrecadado" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
