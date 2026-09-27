import { Link } from 'react-router-dom';
import { Building2, CalendarDays, LogOut, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  FamilyInvestment,
  REMOVABLE_RESIDENT_STATUSES,
  ResidentStatus,
  Role,
} from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PersonAvatar } from '@/components/shared/PersonAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const ACTIVE_STATUSES = new Set<ResidentStatus>([
  ResidentStatus.PRE_ADMISSION,
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
]);

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Returns the next unpaid month's due info.
 * If lastContributionDate is in current month or future, next unpaid = one month after it.
 * Otherwise next unpaid = current month.
 */
function getNextDueInfo(
  entryDate: string,
  lastContributionDate: string | null,
  contributionDueDay: number | null,
): { year: number; month: number; day: number; isoDate: string } {
  const dueDay = contributionDueDay ?? new Date(entryDate + 'T00:00:00').getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let targetYear = today.getFullYear();
  let targetMonth = today.getMonth(); // 0-indexed

  if (lastContributionDate) {
    const last = new Date(lastContributionDate.slice(0, 10) + 'T00:00:00');
    const lastYM = last.getFullYear() * 12 + last.getMonth();
    const todayYM = today.getFullYear() * 12 + today.getMonth();
    if (lastYM >= todayYM) {
      // Current month already covered — advance to next unpaid month
      const nextYM = lastYM + 1;
      targetYear = Math.floor(nextYM / 12);
      targetMonth = nextYM % 12;
    }
  }

  const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const effectiveDay = Math.min(dueDay, lastDayOfMonth);
  const isoDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;
  return { year: targetYear, month: targetMonth, day: effectiveDay, isoDate };
}

function getPaymentBadge(
  entryDate: string | null,
  familyInvestment: FamilyInvestment | null,
  status: ResidentStatus,
  lastContributionDate: string | null,
  contributionDueDay: number | null,
): { label: string; variant: BadgeVariant; defaultDate: string; referenceMonth: string } | null {
  if (!entryDate || !familyInvestment || familyInvestment === FamilyInvestment.SOCIAL) return null;
  if (!ACTIVE_STATUSES.has(status)) return null;

  const { year, month, day, isoDate } = getNextDueInfo(entryDate, lastContributionDate, contributionDueDay);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(year, month, day);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const monthStr = String(month + 1).padStart(2, '0');
  const label = `Vence ${day}/${monthStr}`;
  const referenceMonth = `${MONTH_NAMES[month]}/${year}`;

  if (diffDays < 0) return { label: `Atrasado ${Math.abs(diffDays)}d`, variant: 'destructive', defaultDate: isoDate, referenceMonth };
  if (diffDays < 5) return { label, variant: 'warning', defaultDate: isoDate, referenceMonth };
  if (diffDays < 15) return { label, variant: 'info', defaultDate: isoDate, referenceMonth };
  return { label, variant: 'success', defaultDate: isoDate, referenceMonth };
}

function formatLocalDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const [y, m, d] = birthDate.split('T')[0].split('-').map(Number);
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
  return age;
}

interface Props {
  resident: Resident;
  onDelete: () => void;
  /** Abre o diálogo de baixa (alta/evasão/transferência) — story 196. */
  onRemove?: () => void;
}

export function ResidentCard({ resident, onDelete, onRemove }: Props) {
  const { role } = useAuth();
  const age = computeAge(resident.birthDate);

  // Story 196 — `PATCH /residents/:id` é ADMIN/COORDINATOR e só faz sentido em
  // quem ainda está acolhido: quem já saiu não sai de novo.
  const canRemove =
    !!onRemove &&
    (role === Role.ADMIN || role === Role.COORDINATOR) &&
    REMOVABLE_RESIDENT_STATUSES.includes(resident.status);
  // `DELETE /residents/:id` (soft delete) é ADMIN-only.
  const canDelete = role === Role.ADMIN;

  const paymentBadge = getPaymentBadge(
    resident.entryDate,
    resident.familyInvestment,
    resident.status,
    resident.lastContributionDate,
    resident.contributionDueDay,
  );

  return (
    <div className="relative flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors">
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
      <div className="flex-1 min-w-0">
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
      <div className="flex flex-wrap gap-1 shrink-0">
        <Badge variant={RESIDENT_STATUS_VARIANT[resident.status]}>
          {RESIDENT_STATUS_LABELS[resident.status]}
        </Badge>
        {resident.familyInvestment === FamilyInvestment.SOCIAL && (
          <Badge variant="destructive">Social</Badge>
        )}
        {paymentBadge && (
          <Link
            to={`/residents/${resident.id}?tab=contributions`}
            className={cn(
              badgeVariants({ variant: paymentBadge.variant }),
              'relative z-10 cursor-pointer hover:opacity-80',
            )}
            title="Ver carnê de contribuição"
          >
            {paymentBadge.label}
          </Link>
        )}
      </div>
      <div className="relative z-10 flex gap-1 shrink-0">
        <Button asChild variant="ghost" size="icon" title="Editar">
          <Link to={`/residents/${resident.id}/edit`}>
            <Pencil size={16} />
          </Link>
        </Button>
        {/* Duas ações destrutivas de consequências opostas não ficam a um clique
            uma da outra: "Remover da casa" e "Excluir" entram no mesmo menu,
            rotuladas. Menu vazio não é renderizado. */}
        {(canRemove || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Ações" aria-label={`Ações de ${resident.name}`}>
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canRemove && (
                <DropdownMenuItem onSelect={() => onRemove?.()}>
                  <LogOut size={14} /> Remover da casa
                </DropdownMenuItem>
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
    </div>
  );
}
