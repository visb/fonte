import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateEvent } from '../hooks/useEvents';
import { EventForm } from './EventForm';
import { toEventInput, type EventFormData } from '../lib/eventSchema';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateEventDialog({ open, onClose }: Props) {
  const mutation = useCreateEvent();

  const handleSubmit = (data: EventFormData) => {
    mutation.mutate(toEventInput(data), {
      onSuccess: () => {
        mutation.reset();
        onClose();
      },
    });
  };

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
        </DialogHeader>
        {open && (
          <EventForm
            isPending={mutation.isPending}
            error={mutation.error}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
