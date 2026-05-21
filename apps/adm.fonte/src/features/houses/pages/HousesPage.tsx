import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { House } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HouseDialog } from '../components/HouseDialog';
import { HouseCard } from '../components/HouseCard';
import { useHouses, useDeleteHouse } from '../hooks/useHouses';

export function HousesPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);

  const { data: houses = [], isLoading, isError, refetch } = useHouses();
  const deleteMutation = useDeleteHouse();

  const openCreate = () => { setEditingHouse(null); setDialogOpen(true); };
  const openEdit = (house: House) => { setEditingHouse(house); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingHouse(null); };

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Casas"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-2" />
            Nova Casa
          </Button>
        }
      />

      {houses.length === 0 ? (
        <EmptyState title="Nenhuma casa cadastrada." />
      ) : (
        <div className="space-y-3">
          {houses.map((house) => (
            <HouseCard
              key={house.id}
              house={house}
              onNavigate={() => navigate(`/houses/${house.id}`)}
              onEdit={() => openEdit(house)}
              onDelete={() => setDeleteTarget(house)}
            />
          ))}
        </div>
      )}

      <HouseDialog open={dialogOpen} house={editingHouse} onClose={closeDialog} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Casa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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
