import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AssociateListItem } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useAssociates,
  useDeleteAssociate,
  useCancelAssociateSubscription,
} from '../hooks/useAssociates';
import { AssociateRow } from '../components/AssociateRow';
import { CreateAssociateDialog } from '../components/CreateAssociateDialog';
import { EditAssociateDialog } from '../components/EditAssociateDialog';

export function AssociatesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssociateListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssociateListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AssociateListItem | null>(null);

  const { data: associates = [], isLoading, error, refetch } = useAssociates();
  const deleteMutation = useDeleteAssociate();
  const cancelMutation = useCancelAssociateSubscription();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Associados"
        description="Cadastro de associados contribuintes."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Novo associado
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error, 'Erro ao carregar associados.')} onRetry={refetch} />
      ) : associates.length === 0 ? (
        <EmptyState title="Nenhum associado cadastrado." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Contribuição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {associates.map((a) => (
                <AssociateRow
                  key={a.id}
                  associate={a}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                  onCancelSubscription={setCancelTarget}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateAssociateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditAssociateDialog
        open={!!editTarget}
        associate={editTarget}
        onClose={() => setEditTarget(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir associado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCancelTarget(null);
            cancelMutation.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar recorrência</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar a contribuição mensal recorrente de <strong>{cancelTarget?.name}</strong>? O
              cartão deixará de ser cobrado. Esta ação não pode ser desfeita pelo associado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelMutation.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(cancelMutation.error, 'Erro ao cancelar a recorrência.')}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (cancelTarget) {
                  cancelMutation.mutate(cancelTarget.id, {
                    onSuccess: () => setCancelTarget(null),
                  });
                }
              }}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar recorrência'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
