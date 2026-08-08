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
import { useReopenReceivable } from '../hooks/useResidentReceivables';

interface Props {
  residentId: string;
  receivable: ResidentReceivable | null;
  onClose: () => void;
}

/** Confirmação de reabertura de parcela — busca a própria mutation. */
export function ReopenReceivableDialog({ residentId, receivable, onClose }: Props) {
  const reopenMutation = useReopenReceivable(residentId);

  return (
    <AlertDialog open={!!receivable} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir parcela?</AlertDialogTitle>
          <AlertDialogDescription>
            O pagamento será desfeito e o comprovante anexado removido. A parcela volta a ficar pendente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reopenMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              if (receivable) {
                reopenMutation.mutate(receivable.id, { onSuccess: onClose });
              }
            }}
            disabled={reopenMutation.isPending}
          >
            Reabrir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
