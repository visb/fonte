import type { Associate } from '@fonte/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUpdateAssociate } from '../hooks/useAssociates';
import { AssociateForm } from './AssociateForm';
import type { AssociateFormData } from '../lib/associateSchema';

interface Props {
  open: boolean;
  associate: Associate | null;
  onClose: () => void;
}

export function EditAssociateDialog({ open, associate, onClose }: Props) {
  const updateMutation = useUpdateAssociate();

  const handleSubmit = (data: AssociateFormData) => {
    if (!associate) return;
    updateMutation.mutate(
      {
        id: associate.id,
        data: {
          name: data.name,
          whatsapp: data.whatsapp,
          email: data.email ? data.email : undefined,
          contributionAmount: data.contributionAmount,
          dueDay: data.dueDay,
        },
      },
      { onSuccess: () => { updateMutation.reset(); onClose(); } },
    );
  };

  const handleClose = () => {
    updateMutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar associado</DialogTitle>
        </DialogHeader>
        {open && associate && (
          <AssociateForm
            associate={associate}
            isPending={updateMutation.isPending}
            error={updateMutation.error}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
