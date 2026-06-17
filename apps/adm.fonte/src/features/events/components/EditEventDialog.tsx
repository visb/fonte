import type { Event } from '@fonte/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useUpdateEvent } from '../hooks/useEvents';
import { EventForm } from './EventForm';
import { EventBannerUpload } from './EventBannerUpload';
import { toEventInput, type EventFormData } from '../lib/eventSchema';

interface Props {
  open: boolean;
  event: Event | null;
  onClose: () => void;
}

export function EditEventDialog({ open, event, onClose }: Props) {
  const mutation = useUpdateEvent();

  const handleSubmit = (data: EventFormData) => {
    if (!event) return;
    mutation.mutate(
      { id: event.id, data: toEventInput(data) },
      {
        onSuccess: () => {
          mutation.reset();
          onClose();
        },
      },
    );
  };

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar evento</DialogTitle>
        </DialogHeader>
        {open && event && (
          <>
            <div className="space-y-1 pt-2">
              <Label>Banner</Label>
              <EventBannerUpload event={event} />
            </div>
            <EventForm
              key={event.id}
              event={event}
              isPending={mutation.isPending}
              error={mutation.error}
              onSubmit={handleSubmit}
              onCancel={handleClose}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
