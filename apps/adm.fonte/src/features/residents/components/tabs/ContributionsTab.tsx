import { useState } from 'react';
import { Role } from '@fonte/types';
import type { Resident, ResidentReceivable } from '@fonte/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
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
import { ContributionPlanCard } from '../ContributionPlanCard';
import { ReceivableRow } from '../ReceivableRow';
import { RegisterPaymentDialog } from '../RegisterPaymentDialog';
import { ChangeContributionPlanDialog } from '../ChangeContributionPlanDialog';
import { useResidentReceivables, useReopenReceivable } from '../../hooks/useResidentReceivables';
import { useInventoryCatalog } from '../../hooks/useProductContributions';

interface Props {
  resident: Resident;
}

export function ContributionsTab({ resident }: Props) {
  const { role } = useAuth();
  const canManage = role === Role.ADMIN || role === Role.COORDINATOR;
  // `houseId` é anulável (filho ARCHIVED/sem casa — migration AllowNullResidentHouse).
  // Sem casa não há carnê nem catálogo de inventário para declarar produtos, então
  // as queries por casa ficam desligadas e a aba mostra um estado vazio coerente.
  const houseId = resident.houseId;

  const { data: receivables, isLoading, isError } = useResidentReceivables(resident.id, {
    enabled: canManage && !!houseId,
  });
  const { data: catalog = [] } = useInventoryCatalog(houseId, { enabled: canManage && !!houseId });
  const reopenMutation = useReopenReceivable(resident.id);

  const [planOpen, setPlanOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<ResidentReceivable | null>(null);
  const [reopenTarget, setReopenTarget] = useState<ResidentReceivable | null>(null);

  if (!canManage) {
    return <EmptyState title="Sem permissão para ver a contribuição." />;
  }

  if (!houseId) {
    return (
      <EmptyState
        title="Sem carnê de contribuição."
        description="A contribuição é gerenciada por casa. Vincule o acolhido a uma casa para gerar o carnê."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ContributionPlanCard resident={resident} canManage={canManage} onChangePlan={() => setPlanOpen(true)} />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Erro ao carregar o carnê." />
      ) : !receivables?.length ? (
        <EmptyState title="Nenhuma parcela gerada." description="Plano social ou acolhido isento não geram parcelas." />
      ) : (
        <div className="space-y-2">
          {receivables.map((r) => (
            <ReceivableRow
              key={r.id}
              receivable={r}
              canManage={canManage}
              catalog={catalog}
              onPayClick={setPayTarget}
              onReopenClick={setReopenTarget}
            />
          ))}
        </div>
      )}

      <ChangeContributionPlanDialog open={planOpen} onClose={() => setPlanOpen(false)} resident={resident} />

      <RegisterPaymentDialog
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        residentId={resident.id}
        residentName={resident.name}
        houseId={houseId}
        receivable={payTarget}
      />

      <AlertDialog open={!!reopenTarget} onOpenChange={(o) => !o && setReopenTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir parcela?</AlertDialogTitle>
            <AlertDialogDescription>
              O pagamento será desfeito e o comprovante anexado removido. A parcela volta a ficar pendente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopenMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (reopenTarget) {
                  reopenMutation.mutate(reopenTarget.id, { onSuccess: () => setReopenTarget(null) });
                }
              }}
              disabled={reopenMutation.isPending}
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
