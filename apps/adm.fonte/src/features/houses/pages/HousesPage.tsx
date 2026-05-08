import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Home, MapPin, Pencil, Phone, Plus, Trash2, User } from 'lucide-react';
import { api } from '@/lib/api';
import type { House } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { houseSchema, sanitizeHouseData, type HouseFormData } from '../constants';
import { HouseFormFields } from '../components/HouseFormFields';
import { useHouses, useCreateHouse, useUpdateHouse, useDeleteHouse } from '../hooks/useHouses';
import { useStaff } from '@/features/staff/hooks/useStaff';

export function HousesPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<HouseFormData>({ resolver: zodResolver(houseSchema) });

  const { data: houses = [], isLoading, isError, refetch } = useHouses();

  const { data: staffList = [] } = useStaff({ enabled: dialogOpen });

  const createMutation = useCreateHouse();
  const updateMutation = useUpdateHouse(editingHouse?.id ?? '');
  const deleteMutation = useDeleteHouse();

  const emptyForm: HouseFormData = {
    name: '', generalCapacity: undefined, staffCapacity: undefined,
    address: '', city: '', state: '', coordinatorId: '', phone: '',
  };

  const openCreate = () => {
    setEditingHouse(null);
    reset(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (house: House) => {
    setEditingHouse(house);
    reset({
      name: house.name,
      generalCapacity: house.generalCapacity ?? undefined,
      staffCapacity: house.staffCapacity ?? undefined,
      address: house.address ?? '',
      city: house.city ?? '',
      state: house.state ?? '',
      coordinatorId: house.coordinatorId ?? '',
      phone: house.phone ?? '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingHouse(null);
    reset(emptyForm);
  };

  const onSubmit = (data: HouseFormData) => {
    const payload = sanitizeHouseData(data);
    if (editingHouse) {
      updateMutation.mutate(payload, { onSuccess: closeDialog });
    } else {
      createMutation.mutate(payload, { onSuccess: closeDialog });
    }
  };

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
            <div
              key={house.id}
              className="flex w-full overflow-hidden rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/houses/${house.id}`)}
            >
              <div className="w-20 sm:w-36 shrink-0 bg-muted">
                {house.thumbnailUrl ? (
                  <img src={api.photoUrl(house.thumbnailUrl)!} alt={house.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Home size={28} />
                  </div>
                )}
              </div>

              <div className="flex flex-1 items-center gap-3 sm:gap-6 px-3 sm:px-5 py-4 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">{house.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    {(house.city || house.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {[house.city, house.state].filter(Boolean).join(' — ')}
                      </span>
                    )}
                    {house.coordinator && (
                      <span className="flex items-center gap-1">
                        <User size={13} />
                        {house.coordinator.name}
                      </span>
                    )}
                    {house.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} />
                        {house.phone}
                      </span>
                    )}
                  </div>
                </div>

                {(house.generalCapacity != null || house.staffCapacity != null) && (
                  <div className="hidden sm:flex gap-4 shrink-0 text-center">
                    <div>
                      <p className="text-xl font-bold leading-none">
                        {Math.max(0, (house.generalCapacity ?? 0) + (house.staffCapacity ?? 0) - house.staffCount - house.activeResidentsCount)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">vagas</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none">{house.activeResidentsCount}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">filhos</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none">{house.staffCount}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">servos</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(house)} title="Editar">
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(house)} title="Excluir">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHouse ? 'Editar Casa' : 'Nova Casa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <HouseFormFields register={register} errors={errors} staffList={staffList} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                {editingHouse ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
