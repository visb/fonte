import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateAssociate } from '../hooks/useAssociates';
import { AssociateForm } from './AssociateForm';
import type { AssociateFormData } from '../lib/associateSchema';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateAssociateDialog({ open, onClose }: Props) {
  const createMutation = useCreateAssociate();

  const handleSubmit = (data: AssociateFormData) => {
    createMutation.mutate(
      {
        name: data.name,
        whatsapp: data.whatsapp,
        email: data.email ? data.email : undefined,
        contributionAmount: data.contributionAmount,
        dueDay: data.dueDay,
      },
      { onSuccess: () => { createMutation.reset(); onClose(); } },
    );
  };

  const handleClose = () => {
    createMutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo associado</DialogTitle>
        </DialogHeader>
        {open && (
          <AssociateForm
            isPending={createMutation.isPending}
            error={createMutation.error}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
