import { ExternalLink, GraduationCap, User } from 'lucide-react';
import type { EligibleResident } from '@fonte/api-client';
import { api } from '@/lib/api';

interface Props {
  resident: EligibleResident;
  checked: boolean;
  onToggle: (id: string) => void;
  /** Marca que o filho já fez o curso fora do sistema (story 127). */
  onMarkExternal: (id: string) => void;
}

function formatMonths(months: number): string {
  return months === 1 ? '1 mês de casa' : `${months} meses de casa`;
}

export function EligibleResidentRow({ resident, checked, onToggle, onMarkExternal }: Props) {
  const src = api.photoUrl(resident.photoThumbUrl);

  // Sem <label> de wrapper (story 125): o link de ficha não pode alternar o
  // checkbox. Checkbox controlado + área de conteúdo clicável, link fora dela.
  return (
    <div className="flex items-center gap-3 border rounded px-3 py-2 hover:bg-muted/50">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 cursor-pointer"
        checked={checked}
        onChange={() => onToggle(resident.id)}
        aria-label={`Selecionar ${resident.name}`}
      />
      <div
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        onClick={() => onToggle(resident.id)}
      >
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
      </div>
      {/* Fora da área clicável: marcar "já fez" não pode alternar o checkbox. */}
      <button
        type="button"
        onClick={() => onMarkExternal(resident.id)}
        title={`Marcar ${resident.name} como já fez o curso`}
        aria-label={`Marcar ${resident.name} como já fez o curso`}
        className="shrink-0 text-muted-foreground hover:text-primary"
      >
        <GraduationCap size={14} />
      </button>
      <a
        href={`/residents/${resident.id}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`Abrir ficha de ${resident.name} em nova aba`}
        aria-label={`Abrir ficha de ${resident.name} em nova aba`}
        className="shrink-0 text-muted-foreground hover:text-primary"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
