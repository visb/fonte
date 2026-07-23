import type { Resident } from '@fonte/api-client';
import { ResidentStatus } from '@fonte/types';
import { Badge } from '@/components/ui/badge';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '@/features/residents/constants';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

interface HouseResidentRowProps {
  resident: Pick<Resident, 'id' | 'name' | 'entryDate' | 'status'>;
  onSelect: (id: string) => void;
}

/** Linha da aba Filhos do detalhe da casa: abre o dialog de detalhes ao clicar. */
export function HouseResidentRow({ resident, onSelect }: HouseResidentRowProps) {
  return (
    <button
      onClick={() => onSelect(resident.id)}
      className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{resident.name}</p>
        <p className="text-xs text-muted-foreground">Entrada: {formatDate(resident.entryDate)}</p>
      </div>
      <Badge variant={RESIDENT_STATUS_VARIANT[resident.status as ResidentStatus] ?? 'outline'}>
        {RESIDENT_STATUS_LABELS[resident.status as ResidentStatus] ?? resident.status}
      </Badge>
    </button>
  );
}
