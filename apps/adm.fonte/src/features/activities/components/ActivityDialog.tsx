import type { Activity } from '@fonte/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateActivity, useUpdateActivity } from '../hooks/useActivities';
import { ActivityForm } from './ActivityForm';
import type { ActivityFormData } from '../lib/activitySchema';

interface Props {
  open: boolean;
  /** Quando fornecido, o dialog edita; caso contrário, cria (rascunho). */
  activity?: Activity | null;
  onClose: () => void;
}

export function ActivityDialog({ open, activity, onClose }: Props) {
  const createMutation = useCreateActivity();
  const updateMutation = useUpdateActivity();
  const isEdit = !!activity;
  const mutation = isEdit ? updateMutation : createMutation;

  const handleSubmit = (data: ActivityFormData) => {
    const payload = {
      title: data.title,
      description: data.description ? data.description : null,
      houseId: data.houseId ? data.houseId : null,
    };

    const onSuccess = () => {
      mutation.reset();
      onClose();
    };

    if (isEdit && activity) {
      updateMutation.mutate({ id: activity.id, data: payload }, { onSuccess });
    } else {
      createMutation.mutate(payload, { onSuccess });
    }
  };

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar atividade' : 'Nova atividade'}</DialogTitle>
        </DialogHeader>
        {open && (
          <ActivityForm
            activity={activity}
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
