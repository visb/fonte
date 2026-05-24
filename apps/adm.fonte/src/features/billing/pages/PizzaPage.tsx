import { Pizza } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export function PizzaPage() {
  return (
    <div>
      <PageHeader
        title="Pizza"
        description="Faturamento de pizzas"
      />
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Pizza size={40} />
        <p>Em desenvolvimento.</p>
      </div>
    </div>
  );
}
