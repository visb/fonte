import { ResidentStatus } from '@fonte/types';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/shared/LoadingState';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../../constants';
import { useResidentAdmissions } from '../../hooks/useResidents';

interface Props {
  residentId: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function AdmissionsTab({ residentId }: Props) {
  const { data: admissions = [], isLoading } = useResidentAdmissions(residentId);

  if (isLoading) return <LoadingState />;

  if (admissions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm space-y-1">
        <p className="font-medium">Nenhum acolhimento registrado.</p>
        <p className="text-xs">O histórico é criado a partir do primeiro acolhimento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {admissions.map((admission, index) => {
        const statusKey = admission.status as ResidentStatus;
        const label = RESIDENT_STATUS_LABELS[statusKey] ?? admission.status;
        const variant = RESIDENT_STATUS_VARIANT[statusKey] ?? 'secondary';

        return (
          <div key={admission.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Acolhimento {admissions.length - index}
              </h4>
              <Badge variant={variant}>{label}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <span className="text-muted-foreground">Casa</span>
              <span>{admission.house?.name ?? admission.houseId}</span>

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
      })}
    </div>
  );
}
