import { Package } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export function StoreroomTab() {
  return (
    <EmptyState
      title="Dispensa"
      description="Esta funcionalidade será implementada em breve."
      action={<Package size={40} className="text-muted-foreground" />}
    />
  );
}
