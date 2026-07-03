import { User } from 'lucide-react';
import type { EligibleResident } from '@fonte/api-client';
import { api } from '@/lib/api';

interface Props {
  resident: EligibleResident;
  checked: boolean;
  onToggle: (id: string) => void;
}

function formatMonths(months: number): string {
  return months === 1 ? '1 mês de casa' : `${months} meses de casa`;
}

export function EligibleResidentRow({ resident, checked, onToggle }: Props) {
  const src = api.photoUrl(resident.photoThumbUrl);

  return (
    <label className="flex items-center gap-3 border rounded px-3 py-2 cursor-pointer hover:bg-muted/50">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0"
        checked={checked}
        onChange={() => onToggle(resident.id)}
      />
      <div className="w-9 h-9 rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {src ? (
          <img src={src} alt={resident.name} className="w-full h-full object-cover" />
        ) : (
          <User size={16} className="text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{resident.name}</span>
        <p className="text-xs text-muted-foreground truncate">
          {resident.houseName} · {formatMonths(resident.monthsInTreatment)}
        </p>
      </div>
    </label>
  );
}
