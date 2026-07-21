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
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { useRemoveMySignature } from '@/features/staff/hooks/useStaff';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Story 138 — confirmação destrutiva antes de remover a assinatura do perfil.
// Autossuficiente: dispara a própria mutation e fecha ao concluir.
export function RemoveSignatureDialog({ open, onClose }: Props) {
  const mutation = useRemoveMySignature();

  const handleConfirm = () => {
    mutation.mutate(undefined, { onSuccess: () => onClose() });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover assinatura?</AlertDialogTitle>
          <AlertDialogDescription>
            A assinatura configurada será removida do seu perfil. Você poderá desenhar uma nova a
            qualquer momento.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {getErrorMessage(mutation.error, 'Erro ao remover assinatura.')}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {mutation.isPending ? 'Removendo...' : 'Remover'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
