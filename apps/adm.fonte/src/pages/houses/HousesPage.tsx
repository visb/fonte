import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface House {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const houseSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
});
type HouseFormData = z.infer<typeof houseSchema>;

const fetchHouses = () => api.get<House[]>('/houses').then((r) => r.data);
const createHouse = (data: HouseFormData) =>
  api.post<House>('/houses', data).then((r) => r.data);
const updateHouse = ({ id, ...data }: { id: string } & HouseFormData) =>
  api.patch<House>(`/houses/${id}`, data).then((r) => r.data);
const deleteHouse = (id: string) => api.delete(`/houses/${id}`);

export function HousesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HouseFormData>({ resolver: zodResolver(houseSchema) });

  const { data: houses = [], isLoading, isError } = useQuery({
    queryKey: ['houses'],
    queryFn: fetchHouses,
  });

  const createMutation = useMutation({
    mutationFn: createHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditingHouse(null);
    reset({ name: '' });
    setDialogOpen(true);
  };

  const openEdit = (house: House) => {
    setEditingHouse(house);
    reset({ name: house.name });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingHouse(null);
    reset({ name: '' });
  };

  const onSubmit = (data: HouseFormData) => {
    if (editingHouse) {
      updateMutation.mutate({ id: editingHouse.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (isError) return <p className="text-destructive">Erro ao carregar casas.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Casas</h1>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" />
          Nova Casa
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {houses.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Nenhuma casa cadastrada.
              </TableCell>
            </TableRow>
          )}
          {houses.map((house) => (
            <TableRow key={house.id}>
              <TableCell className="font-medium">{house.name}</TableCell>
              <TableCell>
                {new Date(house.createdAt).toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(house)}>
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(house)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHouse ? 'Editar Casa' : 'Nova Casa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...register('name')} placeholder="Ex: Casa da Paz" />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
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
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
