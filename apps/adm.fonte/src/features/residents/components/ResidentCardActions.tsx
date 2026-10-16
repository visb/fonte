import { Link } from 'react-router-dom';
import { ArrowLeftRight, LogOut, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  REMOVABLE_RESIDENT_STATUSES,
  RESIDENT_ROW_ACTION_LABELS,
  Role,
  type ResidentRowAction,
} from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  resident: Resident;
  onDelete: () => void;
  onRemove?: (mode: ResidentRowAction) => void;
}

/**
 * Botões do card de filho (editar + menu `⋮`). Ficam acima do stretched link
 * (`z-10`). No mobile vão para o fim do card, alinhados à direita (story 206).
 */
export function ResidentCardActions({ resident, onDelete, onRemove }: Props) {
  const { role } = useAuth();

  // Story 196 — `PATCH /residents/:id` é ADMIN/COORDINATOR e só faz sentido em
  // quem ainda está acolhido: quem já saiu não sai de novo.
  const canRemove =
    !!onRemove &&
    (role === Role.ADMIN || role === Role.COORDINATOR) &&
    REMOVABLE_RESIDENT_STATUSES.includes(resident.status);
  // `DELETE /residents/:id` (soft delete) é ADMIN-only.
  const canDelete = role === Role.ADMIN;

  return (
    <div
      data-testid="resident-card-actions"
      className="relative z-10 flex shrink-0 gap-1 self-end sm:self-auto"
    >
      <Button asChild variant="ghost" size="icon" title="Editar">
        <Link to={`/residents/${resident.id}/edit`}>
          <Pencil size={16} />
        </Link>
      </Button>
      {/* Ações de consequências opostas não ficam a um clique uma da outra:
          "Declarar saída da comunidade", "Transferir de casa" (story 200) e
          "Excluir" entram no mesmo menu, rotuladas. Menu vazio não é
          renderizado. */}
      {(canRemove || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Ações" aria-label={`Ações de ${resident.name}`}>
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {canRemove && (
              <>
                <DropdownMenuItem onSelect={() => onRemove?.('exit')}>
                  <LogOut size={14} /> {RESIDENT_ROW_ACTION_LABELS.exit}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRemove?.('transfer')}>
                  <ArrowLeftRight size={14} /> {RESIDENT_ROW_ACTION_LABELS.transfer}
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={14} /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
