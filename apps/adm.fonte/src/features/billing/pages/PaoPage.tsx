import { Wheat } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export function PaoPage() {
  return (
    <div>
      <PageHeader
        title="Pão"
        description="Faturamento de pães"
      />
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Wheat size={40} />
        <p>Em desenvolvimento.</p>
      </div>
    </div>
  );
}
