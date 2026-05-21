import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Resident } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useResidents, useDeleteResident } from '../hooks/useResidents';
import { ResidentCard } from '../components/ResidentCard';

export function ResidentsPage() {
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);

  const { data: residents = [], isLoading, isError, refetch } = useResidents();
  const deleteMutation = useDeleteResident();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Filhos"
        actions={
          <Button asChild>
            <Link to="/residents/new">
              <Plus size={16} className="mr-2" />
              Novo acolhimento
            </Link>
          </Button>
        }
      />

      {residents.length === 0 ? (
        <EmptyState title="Nenhum acolhido cadastrado." />
      ) : (
        <div className="space-y-3">
          {residents.map((resident) => (
            <ResidentCard
              key={resident.id}
              resident={resident}
              onDelete={() => setDeleteTarget(resident)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acolhido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
