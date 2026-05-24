import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ContributionSummaryCardsProps {
  totalResidents: number;
  totalPaid: number;
  totalPending: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ContributionSummaryCards({
  totalResidents,
  totalPaid,
  totalPending,
  totalExpectedAmount,
  totalCollectedAmount,
}: ContributionSummaryCardsProps) {
  const cards = [
    { title: 'Total de Filhos', value: String(totalResidents) },
    { title: 'Pagos', value: String(totalPaid) },
    { title: 'Pendentes', value: String(totalPending) },
    { title: 'Valor Esperado', value: formatBRL(totalExpectedAmount) },
    { title: 'Valor Arrecadado', value: formatBRL(totalCollectedAmount) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
