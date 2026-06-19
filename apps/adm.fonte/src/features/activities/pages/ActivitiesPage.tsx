import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ActivityStatus, Role } from '@fonte/types';
import type { Activity, ListActivitiesParams } from '@fonte/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useActivities,
  useChangeActivityStatus,
  useDeleteActivity,
} from '../hooks/useActivities';
import { ActivityBoard } from '../components/ActivityBoard';
import { ActivityFilters } from '../components/ActivityFilters';
import { ActivityDialog } from '../components/ActivityDialog';
import { ApproveActivityDialog } from '../components/ApproveActivityDialog';

export function ActivitiesPage() {
  const { role } = useAuth();
  const isAdmin = role === Role.ADMIN;

  const [filters, setFilters] = useState<ListActivitiesParams>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Activity | null>(null);
  const [approveTarget, setApproveTarget] = useState<Activity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);

  const { data: activities, isLoading, error, refetch } = useActivities(filters);
  const changeStatus = useChangeActivityStatus();
  const deleteMutation = useDeleteActivity();

  const handleChangeStatus = (activity: Activity, status: ActivityStatus) => {
    changeStatus.mutate({ id: activity.id, data: { status } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atividades"
        description="Board de tarefas operacionais da comunidade."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Nova atividade
          </Button>
        }
      />

      <ActivityFilters filters={filters} onChange={setFilters} showHouseFilter={isAdmin} />

      {changeStatus.error != null && (
        <p className="text-sm text-destructive">
          {getErrorMessage(changeStatus.error, 'Erro ao mover atividade.')}
        </p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={getErrorMessage(error, 'Erro ao carregar atividades.')}
          onRetry={refetch}
        />
      ) : (
        // O board sempre renderiza: mesmo sem atividades, o quick-add no rodapé
        // da coluna "Rascunho" permite criar a primeira inline (estilo Trello).
        <ActivityBoard
          activities={activities ?? []}
          isAdmin={isAdmin}
          role={role}
          onChangeStatus={handleChangeStatus}
          onApprove={setApproveTarget}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
        />
      )}

      <ActivityDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ActivityDialog
        open={!!editTarget}
        activity={editTarget}
        onClose={() => setEditTarget(null)}
      />
      <ApproveActivityDialog
        open={!!approveTarget}
        activity={approveTarget}
        onClose={() => setApproveTarget(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.title}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
