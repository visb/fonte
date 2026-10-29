import { toast } from 'sonner';
import { ReceivableStatus } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getErrorMessage } from '@/lib/errors';
import { useSetReceivableStatus } from '../hooks/useResidentReceivables';
import { formatReferenceMonth } from '../lib/receivables';

interface Props {
  residentId: string;
  receivable: ResidentReceivable | null;
  onClose: () => void;
}

/**
 * Confirmação da troca PENDENTE ↔ CANCELADA de uma parcela. O sentido sai do
 * status atual: pendente é cancelada, cancelada volta a ficar pendente.
 */
export function ChangeReceivableStatusDialog({ residentId, receivable, onClose }: Props) {
  const mutation = useSetReceivableStatus(residentId);
  const canceling = receivable?.status === ReceivableStatus.PENDING;
  const month = receivable ? formatReferenceMonth(receivable.referenceMonth) : '';

  const confirm = () => {
    if (!receivable) return;
    mutation.mutate(
      {
        receivableId: receivable.id,
        status: canceling ? ReceivableStatus.CANCELED : ReceivableStatus.PENDING,
      },
      {
        onSuccess: onClose,
        onError: (error) => toast.error(getErrorMessage(error, 'Erro ao alterar a parcela')),
      },
    );
  };

  return (
    <AlertDialog open={!!receivable} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {canceling ? `Cancelar parcela de ${month}?` : `Marcar ${month} como pendente?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canceling
              ? 'A parcela deixa de ser cobrada e não conta mais como atraso.'
              : 'A parcela volta a ser cobrada e conta como atraso se já tiver vencido.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
            disabled={mutation.isPending}
          >
            {canceling ? 'Cancelar parcela' : 'Marcar como pendente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
