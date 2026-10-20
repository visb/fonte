import { Pencil } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import type { Admission } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';

interface Props {
  admission: Admission;
  title: string;
  /** Presente = mostra o ícone de editar (o gate de role fica com quem renderiza). */
  onEdit?: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Um acolhimento na linha do tempo do Histórico (story 215). Extraído da aba
 * para a 216 misturar acolhimentos e períodos de serviço na mesma lista.
 */
export function AdmissionCard({ admission, title, onEdit }: Props) {
  const statusKey = admission.status as ResidentStatus;
  const label = RESIDENT_STATUS_LABELS[statusKey] ?? admission.status;
  const variant = RESIDENT_STATUS_VARIANT[statusKey] ?? 'secondary';

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="admission-card">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="flex items-center gap-1">
          <Badge variant={variant}>{label}</Badge>
          {onEdit && (
            <Button variant="ghost" size="icon" title="Editar acolhimento" aria-label="Editar acolhimento" onClick={onEdit}>
              <Pencil size={15} />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <span className="text-muted-foreground">Casa</span>
        <span>{admission.house?.name ?? admission.houseId ?? '—'}</span>

        <span className="text-muted-foreground">Entrada</span>
        <span>{formatDate(admission.entryDate)}</span>

        <span className="text-muted-foreground">Saída</span>
        <span>{formatDate(admission.exitDate)}</span>

        {admission.weight != null && (
          <>
            <span className="text-muted-foreground">Peso</span>
            <span>{admission.weight} kg</span>
          </>
        )}
        {admission.height != null && (
          <>
            <span className="text-muted-foreground">Altura</span>
            <span>{admission.height} cm</span>
          </>
        )}
      </div>
    </div>
  );
}
