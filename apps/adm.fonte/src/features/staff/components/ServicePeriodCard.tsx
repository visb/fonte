import { Pencil } from 'lucide-react';
import type { StaffServicePeriod } from '@fonte/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  period: StaffServicePeriod;
  /** Presente = mostra o ícone de editar (o gate de role fica com quem renderiza). */
  onEdit?: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Um período de serviço na linha do tempo do Histórico do servo (story 216). */
export function ServicePeriodCard({ period, onEdit }: Props) {
  const open = !period.endDate;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="service-period-card">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Período de serviço</h4>
        <div className="flex items-center gap-1">
          <Badge variant={open ? 'success' : 'secondary'}>{open ? 'Atual' : 'Encerrado'}</Badge>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              title="Editar período de serviço"
              aria-label="Editar período de serviço"
              onClick={onEdit}
            >
              <Pencil size={15} />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <span className="text-muted-foreground">Casa</span>
        <span>{period.house?.name ?? (period.houseId ? period.houseId : 'Sem casa')}</span>

        <span className="text-muted-foreground">Início</span>
        <span>{formatDate(period.startDate)}</span>

        <span className="text-muted-foreground">Fim</span>
        <span>{open ? 'Em andamento' : formatDate(period.endDate)}</span>
      </div>
    </div>
  );
}
