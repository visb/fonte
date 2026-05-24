import { UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export function AssociadosPage() {
  return (
    <div>
      <PageHeader
        title="Associados"
        description="Faturamento de associados"
      />
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <UsersRound size={40} />
        <p>Em desenvolvimento.</p>
      </div>
    </div>
  );
}
