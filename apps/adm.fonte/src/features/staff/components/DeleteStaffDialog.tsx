import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteStaff } from '../hooks/useStaff';

export const DELETE_CONFIRM_WORD = 'EXCLUIR';

const schema = z.object({
  confirm: z.string().refine((value) => value.trim().toUpperCase() === DELETE_CONFIRM_WORD, {
    message: `Digite ${DELETE_CONFIRM_WORD} para confirmar.`,
  }),
});
type Values = z.infer<typeof schema>;

interface Props {
  staff: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * Story 217 — "Excluir cadastro" virou ação secundária, só para cadastro feito
 * por engano: some de todas as telas e o histórico fica inacessível. A saída
 * normal de um servo é "Desligar". Confirmação forte: digitar EXCLUIR.
 */
export function DeleteStaffDialog({ staff, onClose, onDeleted }: Props) {
  const mutation = useDeleteStaff();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { confirm: '' } });

  useEffect(() => {
    if (staff) reset({ confirm: '' });
  }, [staff, reset]);

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  const onSubmit = () => {
    if (!staff) return;
    mutation.mutate(staff.id, {
      onSuccess: () => {
        handleClose();
        onDeleted?.();
      },
    });
  };

  return (
    <Dialog open={!!staff} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir cadastro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use só para cadastro feito por engano. <strong>{staff?.name}</strong> some de todas as telas e o
            histórico fica inacessível. Para registrar a saída de um servo, use <strong>Desligar</strong>.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="delete-staff-confirm" className="text-sm font-medium">
              Digite {DELETE_CONFIRM_WORD} para confirmar
            </label>
            <Input id="delete-staff-confirm" autoComplete="off" {...register('confirm')} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>
          {mutation.isError && (
            <p className="text-sm text-destructive">{getErrorMessage(mutation.error, 'Erro ao excluir o cadastro.')}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
