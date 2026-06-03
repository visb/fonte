import { ReceivableStatus } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';
import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "2026-06-01" → "Junho/2026" */
export function formatReferenceMonth(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTH_NAMES[m - 1]}/${y}`;
}

/** "2026-06-10" → "10/06/2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function isOverdue(r: ResidentReceivable): boolean {
  if (r.status !== ReceivableStatus.PENDING || !r.mandatory) return false;
  return r.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

export interface ReceivableBadge {
  label: string;
  variant: BadgeVariant;
}

export function receivableBadge(r: ResidentReceivable): ReceivableBadge {
  if (r.status === ReceivableStatus.PAID) return { label: 'Pago', variant: 'success' };
  if (r.status === ReceivableStatus.CANCELED) return { label: 'Cancelado', variant: 'secondary' };
  if (isOverdue(r)) return { label: 'Atrasado', variant: 'destructive' };
  return { label: 'Pendente', variant: 'warning' };
}
