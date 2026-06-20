import type { Event } from '@fonte/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useEventRegistrations } from '../hooks/useEvents';
import { RegistrationCard } from './RegistrationCard';

interface Props {
  open: boolean;
  event: Event | null;
  onClose: () => void;
}

/**
 * Lista as inscrições recebidas de um evento, com as respostas dos campos
 * custom (story 68). Dialog autossuficiente: busca seus próprios dados.
 */
export function EventRegistrationsDialog({ open, event, onClose }: Props) {
  const { data, isLoading, error, refetch } = useEventRegistrations(event?.id ?? '', {
    enabled: open && !!event,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscritos — {event?.title}</DialogTitle>
          <DialogDescription>
            Respostas enviadas no formulário de inscrição.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, 'Erro ao carregar inscritos.')} onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nenhuma inscrição ainda." />
        ) : (
          <div className="space-y-3">
            {data.map((reg) => (
              <RegistrationCard key={reg.id} registration={reg} fields={event?.registrationFields ?? []} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
