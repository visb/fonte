import { FamilyInvestment, ResidentStatus } from '@fonte/types';
import type { BadgeProps } from '@/components/ui/badge';

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

export interface PaymentBadgeInfo {
  label: string;
  variant: BadgeVariant;
  defaultDate: string;
  referenceMonth: string;
}

/**
 * Returns the next unpaid month's due info.
 * If lastContributionDate is in current month or future, next unpaid = one month after it.
 * Otherwise next unpaid = current month.
 */
export function getNextDueInfo(
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

export function getPaymentBadge(
  entryDate: string | null,
  familyInvestment: FamilyInvestment | null,
  status: ResidentStatus,
  lastContributionDate: string | null,
  contributionDueDay: number | null,
): PaymentBadgeInfo | null {
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

export function formatLocalDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

export function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const [y, m, d] = birthDate.split('T')[0].split('-').map(Number);
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
  return age;
}
