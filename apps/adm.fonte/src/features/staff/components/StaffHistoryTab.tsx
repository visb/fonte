import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Role, type StaffServicePeriod } from '@fonte/types';
import type { Admission } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useResidentAdmissions } from '@/features/residents/hooks/useResidents';
import { buildHistory } from '@/features/residents/lib/history';
import { AdmissionCard } from '@/features/residents/components/AdmissionCard';
import { AdmissionFormDialog } from '@/features/residents/components/AdmissionFormDialog';
import { useStaffServicePeriods } from '../hooks/useStaff';
import { ServicePeriodCard } from './ServicePeriodCard';
import { ServicePeriodFormDialog } from './ServicePeriodFormDialog';

interface Props {
  staffId: string;
  /** Ex-filho promovido: os acolhimentos da fase de filho entram na linha do tempo. */
  formerResidentId?: string | null;
}

// O item fica guardado ao fechar: o título não troca durante a animação.
type ServiceDialog = { open: boolean; period: StaffServicePeriod | null };
type AdmissionDialog = { open: boolean; admission: Admission | null };

/**
 * Aba Histórico do servo (story 216): linha do tempo com os períodos de
 * serviço e, para ex-filho, os acolhimentos (cards da 215), do início mais
 * recente ao mais antigo. ADMIN registra e corrige; os demais leem.
 */
export function StaffHistoryTab({ staffId, formerResidentId }: Props) {
  const { role } = useAuth();
  const canEdit = role === Role.ADMIN;
  const residentId = formerResidentId ?? '';
  const periodsQuery = useStaffServicePeriods(staffId);
  const admissionsQuery = useResidentAdmissions(residentId, { enabled: !!residentId });
  const [service, setService] = useState<ServiceDialog>({ open: false, period: null });
  const [admission, setAdmission] = useState<AdmissionDialog>({ open: false, admission: null });

  if (periodsQuery.isLoading || admissionsQuery.isLoading) return <LoadingState />;

  const items = buildHistory(admissionsQuery.data ?? [], periodsQuery.data ?? []);

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end gap-2">
          {residentId && (
            <Button size="sm" variant="outline" onClick={() => setAdmission({ open: true, admission: null })}>
              <Plus size={15} /> Adicionar acolhimento
            </Button>
          )}
          <Button size="sm" onClick={() => setService({ open: true, period: null })}>
            <Plus size={15} /> Adicionar período de serviço
          </Button>
        </div>
      )}

      {items.length === 0 && <EmptyState title="Nenhum registro no histórico." />}

      {items.map((item) =>
        item.kind === 'service' ? (
          <ServicePeriodCard
            key={item.key}
            period={item.period}
            onEdit={canEdit ? () => setService({ open: true, period: item.period }) : undefined}
          />
        ) : (
          <AdmissionCard
            key={item.key}
            title={item.title}
            admission={item.admission}
            onEdit={canEdit ? () => setAdmission({ open: true, admission: item.admission }) : undefined}
          />
        ),
      )}

      {canEdit && (
        <ServicePeriodFormDialog
          open={service.open}
          onClose={() => setService((state) => ({ ...state, open: false }))}
          staffId={staffId}
          period={service.period}
        />
      )}
      {canEdit && residentId && (
        <AdmissionFormDialog
          open={admission.open}
          onClose={() => setAdmission((state) => ({ ...state, open: false }))}
          residentId={residentId}
          admission={admission.admission}
        />
      )}
    </div>
  );
}
