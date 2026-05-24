import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, Pencil, Trash2, User } from 'lucide-react';
import { FamilyInvestment, ResidentStatus } from '@fonte/types';
import { api } from '@/lib/api';
import type { Resident } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';
import { DeclarePaymentDialog } from './DeclarePaymentDialog';

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
): { year: number; month: number; day: number; isoDate: string } {
  const dueDay = new Date(entryDate + 'T00:00:00').getDate();
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
): { label: string; variant: BadgeVariant; defaultDate: string; referenceMonth: string } | null {
  if (!entryDate || !familyInvestment || familyInvestment === FamilyInvestment.SOCIAL) return null;
  if (!ACTIVE_STATUSES.has(status)) return null;

  const { year, month, day, isoDate } = getNextDueInfo(entryDate, lastContributionDate);

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

function ResidentAvatar({ url, name }: { url: string | null; name: string }) {
  const src = api.photoUrl(url);
  return (
    <div className="w-10 h-10 rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <User size={18} className="text-muted-foreground" />
      )}
    </div>
  );
}

interface Props {
  resident: Resident;
  onDelete: () => void;
}

export function ResidentCard({ resident, onDelete }: Props) {
  const navigate = useNavigate();
  const age = computeAge(resident.birthDate);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const paymentBadge = getPaymentBadge(
    resident.entryDate,
    resident.familyInvestment,
    resident.status,
    resident.lastContributionDate,
  );

  return (
    <>
      <div
        className="flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => navigate(`/residents/${resident.id}`)}
      >
        <ResidentAvatar url={resident.photoUrl} name={resident.name} />
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
          {paymentBadge && (
            <Badge
              variant={paymentBadge.variant}
              className="cursor-pointer hover:opacity-80"
              onClick={(e) => { e.stopPropagation(); setPaymentDialogOpen(true); }}
              title="Clique para declarar pagamento"
            >
              {paymentBadge.label}
            </Badge>
          )}
        </div>
        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/residents/${resident.id}/edit`)} title="Editar">
            <Pencil size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Excluir"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {paymentBadge && (
        <DeclarePaymentDialog
          open={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
          resident={{ id: resident.id, name: resident.name }}
          defaultDate={paymentBadge.defaultDate}
          referenceMonth={paymentBadge.referenceMonth}
        />
      )}
    </>
  );
}
