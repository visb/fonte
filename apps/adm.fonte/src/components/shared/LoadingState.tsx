import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Carregando...' }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-8">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
