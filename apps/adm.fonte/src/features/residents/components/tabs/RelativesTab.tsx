import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Relative } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useResidentRelatives, useDeleteRelative } from '../../hooks/useResidents';
import { AddRelativeDialog } from '../AddRelativeDialog';
import { RelativeCard } from '../RelativeCard';
import { GenerateRelativeAccessDialog } from '../GenerateRelativeAccessDialog';
import { ResetRelativePasswordDialog } from '../ResetRelativePasswordDialog';

interface Props {
  residentId: string;
}

export function RelativesTab({ residentId }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Relative | null>(null);
  const [accessTarget, setAccessTarget] = useState<Relative | null>(null);
  const [resetTarget, setResetTarget] = useState<Relative | null>(null);

  const { data: relatives = [], isLoading } = useResidentRelatives(residentId);
  const deleteMutation = useDeleteRelative(residentId);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-2" />
          Adicionar familiar
        </Button>
      </div>

      {isLoading ? (
        <LoadingState message="Carregando familiares..." />
      ) : relatives.length === 0 ? (
        <EmptyState title="Nenhum familiar cadastrado." />
      ) : (
        <div className="space-y-2">
          {relatives.map((relative) => (
            <RelativeCard
              key={relative.id}
              relative={relative}
              onGenerateAccess={() => setAccessTarget(relative)}
              onResetPassword={() => setResetTarget(relative)}
              onDelete={() => setDeleteTarget(relative)}
            />
          ))}
        </div>
      )}

      <AddRelativeDialog open={addOpen} onClose={() => setAddOpen(false)} residentId={residentId} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover familiar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenerateRelativeAccessDialog
        open={!!accessTarget}
        onClose={() => setAccessTarget(null)}
        relative={accessTarget}
      />
      <ResetRelativePasswordDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        relative={resetTarget}
      />
    </div>
  );
}
