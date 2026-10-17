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

interface DiscardDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Story 211 (decisão 7): Cancelar com dados preenchidos pede confirmação e apaga o rascunho. */
export function DiscardDraftDialog({ open, onOpenChange, onConfirm }: DiscardDraftDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar acolhimento?</AlertDialogTitle>
          <AlertDialogDescription>
            Os dados preenchidos e o rascunho salvo serão descartados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar preenchendo</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Descartar e sair</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
