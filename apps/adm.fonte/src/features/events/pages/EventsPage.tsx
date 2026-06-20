import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Event } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useEvents, useDeleteEvent } from '../hooks/useEvents';
import { EventTimeline } from '../components/EventTimeline';
import { CreateEventDialog } from '../components/CreateEventDialog';
import { EditEventDialog } from '../components/EditEventDialog';
import { EventRegistrationsDialog } from '../components/EventRegistrationsDialog';

export function EventsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [registrationsTarget, setRegistrationsTarget] = useState<Event | null>(null);

  const { data: events, isLoading, error, refetch } = useEvents();
  const deleteMutation = useDeleteEvent();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Linha do tempo dos eventos da comunidade. Os 3 próximos ficam destacados."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Novo evento
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error, 'Erro ao carregar eventos.')} onRetry={refetch} />
      ) : !events || events.length === 0 ? (
        <EmptyState title="Nenhum evento cadastrado." />
      ) : (
        <EventTimeline
          events={events}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          onViewRegistrations={setRegistrationsTarget}
        />
      )}

      <CreateEventDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditEventDialog
        open={!!editTarget}
        event={editTarget}
        onClose={() => setEditTarget(null)}
      />
      <EventRegistrationsDialog
        open={!!registrationsTarget}
        event={registrationsTarget}
        onClose={() => setRegistrationsTarget(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.title}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
