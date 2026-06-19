import { User } from 'lucide-react';
import type { ActivityStaffRef } from '@fonte/types';
import { getInitials } from '../lib/initials';

interface Props {
  responsible: ActivityStaffRef | null | undefined;
}

/**
 * Mostra o responsável de uma atividade com um avatar de iniciais + nome.
 * Sem responsável → ícone "person" esmaecido + rótulo "Sem responsável"
 * (em vez de espaço vazio), reforçando rascunhos/solicitações sem dono.
 */
export function ResponsibleBadge({ responsible }: Props) {
  if (!responsible) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70"
        title="Sem responsável"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
          <User size={12} aria-hidden="true" />
        </span>
        Sem responsável
      </span>
    );
  }

  const initials = getInitials(responsible.name);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-foreground"
      title={`Responsável: ${responsible.name}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold uppercase text-primary">
        {initials || <User size={12} aria-hidden="true" />}
      </span>
      {responsible.name}
    </span>
  );
}
