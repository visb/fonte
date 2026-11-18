import type { Admission } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteAdmission } from '../hooks/useResidents';

interface Props {
  residentId: string;
  /** Passagem a excluir; `null` = dialog fechado. */
  admission: Admission | null;
  onClose: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Exclusão de passagem encerrada (só ADMIN). O acolhimento atual nem mostra a
 * ação; passagem com parcelas no carnê é recusada pela API com a mensagem.
 */
export function DeleteAdmissionDialog({ residentId, admission, onClose }: Props) {
  const mutation = useDeleteAdmission(residentId);

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  const handleConfirm = () => {
    if (!admission) return;
    mutation.mutate(admission.id, { onSuccess: handleClose });
  };

  return (
    <Dialog open={!!admission} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir acolhimento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Excluir a passagem de <strong>{formatDate(admission?.entryDate)}</strong> a{' '}
          <strong>{formatDate(admission?.exitDate)}</strong>
          {admission?.house?.name ? ` (${admission.house.name})` : ''}? Ela some do histórico do filho.
        </p>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            {getErrorMessage(mutation.error, 'Erro ao excluir o acolhimento.')}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
