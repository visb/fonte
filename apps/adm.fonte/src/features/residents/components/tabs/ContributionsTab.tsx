import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { Role } from '@fonte/types';
import type { Resident, ResidentReceivable } from '@fonte/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ReceiptErrorAlert } from '@/components/shared/ReceiptErrorAlert';
import { ContributionAdmissionSelector } from '../ContributionAdmissionSelector';
import { ContributionPlanCard } from '../ContributionPlanCard';
import { ContributionsEmptyState } from '../ContributionsEmptyState';
import { ReceivableRow } from '../ReceivableRow';
import { RegisterPaymentDialog } from '../RegisterPaymentDialog';
import { ReopenReceivableDialog } from '../ReopenReceivableDialog';
import { ChangeContributionPlanDialog } from '../ChangeContributionPlanDialog';
import { useResidentReceivables } from '../../hooks/useResidentReceivables';
import { useReceivableReceipt } from '../../hooks/useReceivableReceipt';
import { useResidentAdmissions } from '../../hooks/useResidents';
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
  const enabled = canManage && !!houseId;

  const { data: receivables, isLoading, isError } = useResidentReceivables(resident.id, { enabled });
  const { data: admissions = [] } = useResidentAdmissions(resident.id, { enabled });
  const { data: catalog = [] } = useInventoryCatalog(houseId, { enabled });
  // Story 193 — download do recibo da parcela paga (um estado para a aba, como
  // no detalhe do associado: o erro aparece uma vez, acima da lista).
  const receipt = useReceivableReceipt();

  const [planOpen, setPlanOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<ResidentReceivable | null>(null);
  const [reopenTarget, setReopenTarget] = useState<ResidentReceivable | null>(null);
  const [pickedAdmissionId, setPickedAdmissionId] = useState<string | null>(null);

  // A ordem vem do backend (entrada DESC): índice 0 é o acolhimento atual, que é
  // sempre o que abre — o carnê antigo continua consultável, nunca é o default.
  const currentAdmissionId = admissions[0]?.id ?? null;
  const oldestAdmissionId = admissions[admissions.length - 1]?.id ?? null;
  const selectedAdmissionId = pickedAdmissionId ?? currentAdmissionId;
  const selectedAdmission = admissions.find((a) => a.id === selectedAdmissionId) ?? null;
  const isCurrent = selectedAdmissionId === currentAdmissionId;

  // Parcela órfã (`admissionId` nulo, dado legado) é exibida junto ao acolhimento
  // mais antigo — sem grupo extra na UI (decisão 7).
  const visibleReceivables = useMemo(
    () =>
      (receivables ?? []).filter(
        (r) =>
          r.admissionId === selectedAdmissionId ||
          (r.admissionId == null && selectedAdmissionId === oldestAdmissionId),
      ),
    [receivables, selectedAdmissionId, oldestAdmissionId],
  );

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

  // Acolhimento encerrado é somente leitura: pagar/reabrir/declarar produto ali
  // foi como parcelas de um acolhimento antigo acabaram quitadas por engano.
  const canManageSelected = canManage && isCurrent;
  const planUndefined =
    (selectedAdmission?.familyInvestment ?? resident.familyInvestment) == null &&
    !resident.contributionExempt;

  return (
    <div className="space-y-4">
      <ContributionAdmissionSelector
        admissions={admissions}
        selectedAdmissionId={selectedAdmissionId}
        onChange={setPickedAdmissionId}
      />

      <ContributionPlanCard
        resident={resident}
        admission={selectedAdmission}
        canManage={canManageSelected}
        onChangePlan={() => setPlanOpen(true)}
      />

      {!isCurrent && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock size={12} />
          Acolhimento encerrado — somente leitura
        </p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Erro ao carregar o carnê." />
      ) : !visibleReceivables.length ? (
        <ContributionsEmptyState
          isCurrent={isCurrent}
          planUndefined={planUndefined}
          onChangePlan={() => setPlanOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {/* O 404 de template ausente chega como a frase acionável do backend,
              com o atalho "Cadastrar template" (story 212). */}
          {receipt.error && (
            <ReceiptErrorAlert
              message={receipt.error}
              missingTemplateType={receipt.missingTemplateType}
            />
          )}
          {visibleReceivables.map((r) => (
            <ReceivableRow
              key={r.id}
              receivable={r}
              canManage={canManageSelected}
              catalog={catalog}
              onPayClick={setPayTarget}
              onReopenClick={setReopenTarget}
              onDownloadReceipt={(receivableId) =>
                void receipt.download(resident.id, receivableId, {
                  residentName: resident.name,
                  referenceMonth: r.referenceMonth,
                })
              }
              isDownloadingReceipt={receipt.downloadingId === r.id}
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

      <ReopenReceivableDialog
        residentId={resident.id}
        receivable={reopenTarget}
        onClose={() => setReopenTarget(null)}
      />
    </div>
  );
}
