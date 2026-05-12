import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { SupportGroup, SupportGroupMeeting } from '@fonte/api-client';
import { DAY_OF_WEEK_LABELS } from '@fonte/types';
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
  useSupportGroups, useCreateSupportGroup, useUpdateSupportGroup,
  useDeleteSupportGroup, useSupportGroupMeetings,
} from '../hooks/useSupportGroups';
import { useStaff } from '@/features/staff/hooks/useStaff';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  churchName: z.string().min(1, 'Nome da igreja é obrigatório'),
  address: z.string().min(1, 'Endereço é obrigatório'),
  coordinatorId: z.preprocess(
    (val) => (val === '' || val === null ? null : val),
    z.string().uuid().nullable().optional(),
  ),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
});
type FormData = z.infer<typeof schema>;

const DAY_OPTIONS = Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}));

function MeetingHistory({ groupId }: { groupId: string }) {
  const { data: meetings = [], isLoading } = useSupportGroupMeetings(groupId);

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Carregando...</p>;
  if (meetings.length === 0) return <p className="text-xs text-muted-foreground py-2">Nenhuma reunião registrada.</p>;

  return (
    <div className="space-y-1 mt-2">
      {meetings.map((m: SupportGroupMeeting) => (
        <div key={m.id} className="flex items-center justify-between text-xs text-muted-foreground border rounded px-3 py-1.5">
          <span>{new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          <span>{m.checkinCount} {m.checkinCount === 1 ? 'família' : 'famílias'}</span>
          {m.notes && <span className="italic truncate max-w-[120px]">{m.notes}</span>}
        </div>
      ))}
    </div>
  );
}

export function SupportGroupsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SupportGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportGroup | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useSupportGroups();
  const { data: staff = [] } = useStaff();
  const createMutation = useCreateSupportGroup();
  const updateMutation = useUpdateSupportGroup();
  const deleteMutation = useDeleteSupportGroup();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    reset({ name: '', churchName: '', address: '', coordinatorId: null, dayOfWeek: 0 });
    setDialogOpen(true);
  };

  const openEdit = (g: SupportGroup) => {
    reset({
      name: g.name,
      churchName: g.churchName,
      address: g.address,
      coordinatorId: g.coordinatorId,
      dayOfWeek: g.dayOfWeek,
    });
    setEditTarget(g);
  };

  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); reset(); };

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      coordinatorId: data.coordinatorId || null,
    };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload }, { onSuccess: closeDialog });
    } else {
      createMutation.mutate(payload, { onSuccess: closeDialog });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedDay = watch('dayOfWeek');

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Grupos de Apoio"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" />
            Novo grupo
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <EmptyState title="Nenhum grupo de apoio cadastrado." />
      ) : (
        <div className="space-y-2">
          {groups.map((g: SupportGroup) => (
            <div key={g.id} className="rounded-lg border bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  className="flex-1 text-left"
                  onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedId === g.id
                      ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                      : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                    <span className="text-sm font-medium">{g.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-5 mt-0.5">
                    {g.churchName} · {DAY_OF_WEEK_LABELS[g.dayOfWeek]}
                    {g.coordinatorName ? ` · ${g.coordinatorName}` : ''}
                  </p>
                </button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(g)}>
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(g)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>

              {expandedId === g.id && (
                <div className="px-4 pb-4 border-t">
                  <p className="text-xs text-muted-foreground mt-2 mb-1">
                    <strong>Endereço:</strong> {g.address}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">Histórico de reuniões</p>
                  <MeetingHistory groupId={g.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen || !!editTarget} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar grupo de apoio' : 'Novo grupo de apoio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="sg-name">Nome *</Label>
                <Input id="sg-name" {...register('name')} placeholder="Ex: Grupo Recomeço..." autoFocus />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="sg-church">Nome da Igreja *</Label>
                <Input id="sg-church" {...register('churchName')} placeholder="Ex: Igreja Batista Central..." />
                {errors.churchName && <p className="text-xs text-destructive">{errors.churchName.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="sg-address">Endereço *</Label>
                <Input id="sg-address" {...register('address')} placeholder="Ex: Rua das Flores, 123..." />
                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="sg-day">Dia da semana *</Label>
                <select
                  id="sg-day"
                  className="w-full border border-input rounded-md bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={selectedDay}
                  onChange={(e) => setValue('dayOfWeek', Number(e.target.value))}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="sg-coordinator">Coordenador (opcional)</Label>
                <select
                  id="sg-coordinator"
                  className="w-full border border-input rounded-md bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  {...register('coordinatorId')}
                >
                  <option value="">— Sem coordenador</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
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
            <AlertDialogTitle>Excluir grupo de apoio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Todas as reuniões e presenças serão removidas.
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
