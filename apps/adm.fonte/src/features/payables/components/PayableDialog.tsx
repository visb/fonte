import type { Payable } from '@fonte/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreatePayable, useUpdatePayable } from '../hooks/usePayables';
import { PayableForm } from './PayableForm';
import type { PayableFormData } from '../lib/payableSchema';
import { reaisToCents } from '../lib/money';

interface Props {
  open: boolean;
  /** Quando fornecido, o dialog edita; caso contrário, cria. */
  payable?: Payable | null;
  onClose: () => void;
}

export function PayableDialog({ open, payable, onClose }: Props) {
  const createMutation = useCreatePayable();
  const updateMutation = useUpdatePayable();
  const isEdit = !!payable;
  const mutation = isEdit ? updateMutation : createMutation;

  const handleSubmit = (data: PayableFormData) => {
    const payload = {
      description: data.description,
      amount: reaisToCents(data.amount),
      dueDate: data.dueDate,
      category: data.category,
      supplier: data.supplier ? data.supplier : null,
      notes: data.notes ? data.notes : null,
    };

    const onSuccess = () => {
      mutation.reset();
      onClose();
    };

    if (isEdit && payable) {
      updateMutation.mutate({ id: payable.id, data: payload }, { onSuccess });
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
          <DialogTitle>{isEdit ? 'Editar conta' : 'Nova conta a pagar'}</DialogTitle>
        </DialogHeader>
        {open && (
          <PayableForm
            payable={payable}
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
