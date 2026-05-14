import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { SupportGroup, SupportGroupMeeting } from '@fonte/api-client';
import { DAY_OF_WEEK_LABELS } from '@fonte/types';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSupportGroups, useDeleteSupportGroup, useSupportGroupMeetings } from '../hooks/useSupportGroups';
import { SupportGroupDialog } from '../components/SupportGroupDialog';

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
  const deleteMutation = useDeleteSupportGroup();

  const openCreate = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (g: SupportGroup) => { setEditTarget(g); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); };

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

      <SupportGroupDialog open={dialogOpen} group={editTarget} onClose={closeDialog} />

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
