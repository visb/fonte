import { Link } from 'react-router-dom';
import { Building2, CalendarDays } from 'lucide-react';
import type { ResidentRowAction } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { PersonAvatar } from '@/components/shared/PersonAvatar';
import { computeAge, formatLocalDate } from '../utils';
import { ResidentCardActions } from './ResidentCardActions';
import { ResidentCardBadges } from './ResidentCardBadges';

interface Props {
  resident: Resident;
  onDelete: () => void;
  /**
   * Abre o diálogo de baixa (story 196) no modo do item escolhido: saída da
   * comunidade (alta/evasão) ou transferência de casa (story 200).
   */
  onRemove?: (mode: ResidentRowAction) => void;
}

/**
 * Card da listagem de filhos.
 *
 * Story 206 — no mobile (< `sm`) são 2 colunas: avatar | conteúdo, e o
 * conteúdo empilha nome → metadados → badges → botões (botões por último,
 * alinhados à direita). De `sm` para cima o wrapper do conteúdo vira linha e
 * badges/botões voltam a ser colunas à direita, como antes. Um DOM só para
 * os dois breakpoints: nada de cópia escondida por media query.
 */
export function ResidentCard({ resident, onDelete, onRemove }: Props) {
  const age = computeAge(resident.birthDate);

  return (
    <div
      data-testid="resident-card"
      className="relative flex w-full items-start gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors sm:items-center"
    >
      {/* Stretched link: cobre o card inteiro para permitir abrir em nova aba
          (ctrl/meio-click). Ações ficam acima via z-10. */}
      <Link
        to={`/residents/${resident.id}`}
        className="absolute inset-0 rounded-lg"
        aria-label={resident.name}
      />
      <PersonAvatar
        size="md"
        url={resident.photoThumbUrl ?? resident.photoUrl}
        name={resident.name}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div data-testid="resident-card-info" className="min-w-0 sm:flex-1">
          <p className="font-semibold truncate">{resident.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            {resident.house && (
              <span className="flex items-center gap-1">
                <Building2 size={13} />
                {resident.house.name}
              </span>
            )}
            {resident.entryDate && (
              <span className="flex items-center gap-1">
                <CalendarDays size={13} />
                {formatLocalDate(resident.entryDate)}
              </span>
            )}
            {age != null && <span>{age} anos</span>}
          </div>
        </div>
        <ResidentCardBadges resident={resident} />
        <ResidentCardActions resident={resident} onDelete={onDelete} onRemove={onRemove} />
      </div>
    </div>
  );
}
