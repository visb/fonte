import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Ministry {
  id: string;
  name: string;
}

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
});
type FormData = z.infer<typeof schema>;

const fetchMinistries = () =>
  api.get<Ministry[]>('/ministries').then((r) => r.data);

export function MinistriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ministry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ministry | null>(null);

  const { data: ministries = [], isLoading } = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post<Ministry>('/ministries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministries'] });
      setDialogOpen(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      api.patch<Ministry>(`/ministries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministries'] });
      setEditTarget(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ministries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministries'] });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    reset({ name: '' });
    setDialogOpen(true);
  };

  const openEdit = (ministry: Ministry) => {
    reset({ name: ministry.name });
    setEditTarget(ministry);
  };

  const onSubmit = (data: FormData) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Setores</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1.5" />
          Novo setor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Loader2 size={16} className="animate-spin" />
          Carregando...
        </div>
      ) : ministries.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-12">
          Nenhum setor cadastrado.
        </p>
      ) : (
        <div className="space-y-2">
          {ministries.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEdit(m)}
              >
                <Pencil size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(m)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dialog: criar / editar */}
      <Dialog
        open={dialogOpen || !!editTarget}
        onOpenChange={(open) => {
          if (!open) { setDialogOpen(false); setEditTarget(null); reset(); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar setor' : 'Novo setor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2 py-4">
              <Label htmlFor="ministry-name">Nome *</Label>
              <Input
                id="ministry-name"
                {...register('name')}
                placeholder="Ex: Cozinha, Horta, Manutenção..."
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setDialogOpen(false); setEditTarget(null); reset(); }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || isPending}>
                {isPending ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: excluir */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir setor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
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
