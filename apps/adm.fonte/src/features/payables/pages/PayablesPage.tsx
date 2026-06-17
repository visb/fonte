import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ListPayablesParams, Payable } from '@fonte/api-client';
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
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  usePayables,
  usePayableSummary,
  useDeletePayable,
} from '../hooks/usePayables';
import { PayablesSummaryCards } from '../components/PayablesSummaryCards';
import { PayablesFilters } from '../components/PayablesFilters';
import { PayableTable } from '../components/PayableTable';
import { PayableDialog } from '../components/PayableDialog';
import { PayPayableDialog } from '../components/PayPayableDialog';
import { PayableDetailDialog } from '../components/PayableDetailDialog';

export function PayablesPage() {
  const [filters, setFilters] = useState<ListPayablesParams>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Payable | null>(null);
  const [editTarget, setEditTarget] = useState<Payable | null>(null);
  const [payTarget, setPayTarget] = useState<Payable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payable | null>(null);

  const { data: payables, isLoading, error, refetch } = usePayables(filters);
  const { data: summary } = usePayableSummary({ from: filters.from, to: filters.to });
  const deleteMutation = useDeletePayable();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        description="Cadastro e acompanhamento das despesas da comunidade."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Nova conta
          </Button>
        }
      />

      {summary && <PayablesSummaryCards summary={summary} />}

      <PayablesFilters filters={filters} onChange={setFilters} />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error, 'Erro ao carregar contas.')} onRetry={refetch} />
      ) : !payables || payables.length === 0 ? (
        <EmptyState title="Nenhuma conta a pagar encontrada." />
      ) : (
        <PayableTable
          payables={payables}
          onView={setDetailTarget}
          onEdit={setEditTarget}
          onPay={setPayTarget}
          onDelete={setDeleteTarget}
        />
      )}

      <PayableDetailDialog
        open={!!detailTarget}
        payable={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={(p) => { setDetailTarget(null); setEditTarget(p); }}
        onPay={(p) => { setDetailTarget(null); setPayTarget(p); }}
        onDelete={(p) => { setDetailTarget(null); setDeleteTarget(p); }}
      />

      <PayableDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <PayableDialog
        open={!!editTarget}
        payable={editTarget}
        onClose={() => setEditTarget(null)}
      />
      <PayPayableDialog
        open={!!payTarget}
        payable={payTarget}
        onClose={() => setPayTarget(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.description}</strong>?
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
    </div>
  );
}
