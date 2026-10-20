import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Role } from '@fonte/types';
import type { Admission } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useResidentAdmissions } from '../../hooks/useResidents';
import { buildHistory } from '../../lib/history';
import { AdmissionCard } from '../AdmissionCard';
import { AdmissionFormDialog } from '../AdmissionFormDialog';

interface Props {
  residentId: string;
}

// A passagem fica guardada ao fechar: o título não troca durante a animação.
type DialogState = { open: boolean; admission: Admission | null };

/**
 * Aba Histórico (story 215): acolhimentos do filho, do mais recente ao mais
 * antigo. ADMIN adiciona passagem antiga e corrige passagens; os demais leem.
 * No detalhe do servo, a linha do tempo mista é a `StaffHistoryTab` (216).
 */
export function AdmissionsTab({ residentId }: Props) {
  const { role } = useAuth();
  const canEdit = role === Role.ADMIN;
  const { data: admissions = [], isLoading } = useResidentAdmissions(residentId);
  const [dialog, setDialog] = useState<DialogState>({ open: false, admission: null });

  if (isLoading) return <LoadingState />;

  const items = buildHistory(admissions);

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setDialog({ open: true, admission: null })}>
            <Plus size={15} /> Adicionar acolhimento
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm space-y-1">
          <p className="font-medium">Nenhum acolhimento registrado.</p>
          <p className="text-xs">O histórico é criado a partir do primeiro acolhimento.</p>
        </div>
      ) : (
        items.map(
          (item) =>
            item.kind === 'admission' && (
              <AdmissionCard
                key={item.key}
                title={item.title}
                admission={item.admission}
                onEdit={canEdit ? () => setDialog({ open: true, admission: item.admission }) : undefined}
              />
            ),
        )
      )}

      {canEdit && (
        <AdmissionFormDialog
          open={dialog.open}
          onClose={() => setDialog((state) => ({ ...state, open: false }))}
          residentId={residentId}
          admission={dialog.admission}
        />
      )}
    </div>
  );
}
