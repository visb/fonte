import { FamilyInvestment, ResidentStatus } from '@fonte/types';
import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const ACTIVE_STATUSES = new Set<ResidentStatus>([
  ResidentStatus.PRE_ADMISSION,
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
]);

export interface PaymentBadgeInfo {
  label: string;
  variant: BadgeVariant;
}

export interface PaymentBadgeInput {
  familyInvestment: FamilyInvestment | null;
  status: ResidentStatus;
  contributionExempt: boolean;
  /** Vencimento da parcela em aberto mais antiga do carnê (vem da listagem). */
  nextDueDate?: string | null;
}

/**
 * Selo "Vence/Atrasado" do card. Lê o vencimento do carnê real — parcela
 * cancelada ou isenção não geram selo. Antes o mês devido era deduzido do
 * último pagamento, e um filho com o mês corrente cancelado aparecia atrasado.
 */
export function getPaymentBadge(resident: PaymentBadgeInput): PaymentBadgeInfo | null {
  const { familyInvestment, status, contributionExempt, nextDueDate } = resident;
  if (!nextDueDate || !familyInvestment || familyInvestment === FamilyInvestment.SOCIAL) return null;
  if (contributionExempt || !ACTIVE_STATUSES.has(status)) return null;

  const [year, month, day] = nextDueDate.slice(0, 10).split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(year, month - 1, day);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const label = `Vence ${day}/${String(month).padStart(2, '0')}`;

  if (diffDays < 0) return { label: `Atrasado ${Math.abs(diffDays)}d`, variant: 'destructive' };
  if (diffDays < 5) return { label, variant: 'warning' };
  if (diffDays < 15) return { label, variant: 'info' };
  return { label, variant: 'success' };
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
