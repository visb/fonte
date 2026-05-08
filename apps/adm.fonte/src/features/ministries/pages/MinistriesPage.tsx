import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Ministry } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useMinistries, useCreateMinistry, useUpdateMinistry, useDeleteMinistry,
} from '../hooks/useMinistries';

const schema = z.object({ name: z.string().min(1, 'Nome é obrigatório') });
type FormData = z.infer<typeof schema>;

export function MinistriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ministry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ministry | null>(null);

  const { data: ministries = [], isLoading } = useMinistries();
  const createMutation = useCreateMinistry();
  const updateMutation = useUpdateMinistry();
  const deleteMutation = useDeleteMinistry();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const openCreate = () => { reset({ name: '' }); setDialogOpen(true); };
  const openEdit = (m: Ministry) => { reset({ name: m.name }); setEditTarget(m); };
  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); reset(); };

  const onSubmit = (data: FormData) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data }, { onSuccess: closeDialog });
    } else {
      createMutation.mutate(data, { onSuccess: closeDialog });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="Ministérios"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" />
            Novo ministério
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : ministries.length === 0 ? (
        <EmptyState title="Nenhum ministério cadastrado." />
      ) : (
        <div className="space-y-2">
          {ministries.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                <Pencil size={15} />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen || !!editTarget} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar ministério' : 'Novo ministério'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2 py-4">
              <Label htmlFor="ministry-name">Nome *</Label>
              <Input id="ministry-name" {...register('name')} placeholder="Ex: Cozinha, Horta, Manutenção..." autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || isPending}>
                {isPending ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ministério</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
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
