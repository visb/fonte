import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/LoadingState';
import { AddFollowUpDialog } from '../AddFollowUpDialog';
import { TrackingEventItem } from '../TrackingEventItem';
import { useResidentFollowUps } from '../../hooks/useResidentFollowUps';

interface Props {
  residentId: string;
}

export function TrackingTab({ residentId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: followUps, isLoading, isError } = useResidentFollowUps(residentId);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Erro ao carregar acompanhamento." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Histórico de eventos
        </h3>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1.5" />
          Registrar evento
        </Button>
      </div>

      {!followUps?.length ? (
        <EmptyState message="Nenhum evento registrado." />
      ) : (
        <div className="space-y-2">
          {followUps.map((fu) => (
            <TrackingEventItem key={fu.id} followUp={fu} />
          ))}
        </div>
      )}

      <AddFollowUpDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        residentId={residentId}
      />
    </div>
  );
}
