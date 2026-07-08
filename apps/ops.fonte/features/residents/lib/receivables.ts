import { ReceivableStatus } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** "2026-06-01" → "Junho/2026". */
export function formatReferenceMonth(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTH_NAMES[m - 1]}/${y}`;
}

/**
 * A "parcela corrente" onde o operador declara produtos (story 114):
 *  1. a parcela do mês de referência atual, se existir;
 *  2. senão, a parcela PENDENTE mais recente;
 *  3. senão, a parcela mais recente (qualquer status ativo).
 * Parcelas canceladas são ignoradas. `null` quando não há nenhuma.
 */
export function currentReceivable(receivables: ResidentReceivable[]): ResidentReceivable | null {
  const active = receivables.filter((r) => r.status !== ReceivableStatus.CANCELED);
  if (!active.length) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const match = active.find((r) => r.referenceMonth.slice(0, 7) === currentMonth);
  if (match) return match;

  const byMonthDesc = (a: ResidentReceivable, b: ResidentReceivable) =>
    b.referenceMonth.localeCompare(a.referenceMonth);

  const pending = active.filter((r) => r.status === ReceivableStatus.PENDING).sort(byMonthDesc);
  if (pending.length) return pending[0];

  return [...active].sort(byMonthDesc)[0];
}
