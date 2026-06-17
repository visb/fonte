import type { Payable } from '@fonte/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useCreatePayable,
  useUpdatePayable,
  useUploadPayableAttachment,
  useDeletePayableAttachment,
} from '../hooks/usePayables';
import { PayableForm, type PayableSubmit } from './PayableForm';
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
  const uploadAttachment = useUploadPayableAttachment();
  const deleteAttachment = useDeletePayableAttachment();
  const isEdit = !!payable;
  const mutation = isEdit ? updateMutation : createMutation;
  const isPending =
    mutation.isPending || uploadAttachment.isPending || deleteAttachment.isPending;
  const error = mutation.error ?? uploadAttachment.error ?? deleteAttachment.error;

  // Anexo é gerenciado em endpoint próprio, então persiste em duas etapas:
  // grava a conta (JSON) e, com o id em mãos, sobe ou remove o arquivo.
  const syncAttachment = async (id: string, submit: PayableSubmit) => {
    if (submit.file) {
      await uploadAttachment.mutateAsync({ id, file: submit.file });
    } else if (submit.removeAttachment) {
      await deleteAttachment.mutateAsync(id);
    }
  };

  const handleSubmit = (submit: PayableSubmit) => {
    const { data } = submit;
    const payload = {
      description: data.description,
      amount: reaisToCents(data.amount),
      dueDate: data.dueDate,
      category: data.category,
      supplier: data.supplier ? data.supplier : null,
      notes: data.notes ? data.notes : null,
    };

    const finish = () => {
      resetAll();
      onClose();
    };

    if (isEdit && payable) {
      updateMutation.mutate(
        { id: payable.id, data: payload },
        { onSuccess: () => void syncAttachment(payable.id, submit).then(finish) },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => void syncAttachment(created.id, submit).then(finish),
      });
    }
  };

  const resetAll = () => {
    createMutation.reset();
    updateMutation.reset();
    uploadAttachment.reset();
    deleteAttachment.reset();
  };

  const handleClose = () => {
    resetAll();
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
            isPending={isPending}
            error={error}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
