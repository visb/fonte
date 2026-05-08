import type { HouseRule } from '@fonte/api-client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteRule } from '../../hooks/useHouseRules';

interface Props {
  rule: HouseRule | null;
  onClose: () => void;
  houseId: string;
}

export function RemoveRuleDialog({ rule, onClose, houseId }: Props) {
  const mutation = useDeleteRule(houseId);

  return (
    <AlertDialog open={!!rule} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover regra</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover a regra <strong>"{rule?.title}"</strong>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => rule && mutation.mutate(rule.id, { onSuccess: onClose })}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
