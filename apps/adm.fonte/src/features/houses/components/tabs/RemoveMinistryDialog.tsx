import type { HouseMinistry } from '@fonte/api-client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRemoveMinistry } from '../../hooks/useHouseMinistries';

interface Props {
  ministry: HouseMinistry | null;
  onClose: () => void;
  houseId: string;
}

export function RemoveMinistryDialog({ ministry, onClose, houseId }: Props) {
  const mutation = useRemoveMinistry(houseId);

  return (
    <AlertDialog open={!!ministry} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover ministério</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover o ministério <strong>{ministry?.name}</strong> desta casa?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => ministry && mutation.mutate(ministry.id, { onSuccess: onClose })}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
