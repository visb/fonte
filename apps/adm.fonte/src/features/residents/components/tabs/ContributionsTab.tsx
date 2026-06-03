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

interface Props {
  resident: Resident;
}

export function ContributionsTab({ resident }: Props) {
  const { role } = useAuth();
  const canManage = role === Role.ADMIN || role === Role.COORDINATOR;

  const { data: receivables, isLoading, isError } = useResidentReceivables(resident.id, { enabled: canManage });
  const reopenMutation = useReopenReceivable(resident.id);

  const [planOpen, setPlanOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<ResidentReceivable | null>(null);
  const [reopenTarget, setReopenTarget] = useState<ResidentReceivable | null>(null);

  if (!canManage) {
    return <EmptyState title="Sem permissão para ver a contribuição." />;
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
