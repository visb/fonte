import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@fonte/types';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/**
 * Competência `2026-08-01` → `Agosto de 2026`.
 *
 * Lê os componentes da string (como o backend faz em `referenceMonthOf`): um
 * `new Date('2026-08-01')` em fuso negativo cairia em julho e a tela mostraria
 * uma competência diferente da impressa no recibo.
 */
export function formatReferenceMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.slice(0, 10).split('-');
  const index = Number(month) - 1;
  if (!year || Number.isNaN(index) || index < 0 || index > 11) return referenceMonth;
  const name = MONTHS[index];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
}

/** `2026-08-09` → `09/08/2026`; nulo → traço. */
export function formatDate(date: string | null): string {
  if (!date) return '—';
  const [year, month, day] = date.slice(0, 10).split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

/** Valor em reais, com o mesmo formato do recibo. */
export function formatBRL(amount: number): string {
  return `R$ ${amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Rótulo pt-BR da forma de pagamento (dicionário único, em `@fonte/types`). */
export function formatPaymentMethod(method: PaymentMethod | null): string | null {
  return method ? PAYMENT_METHOD_LABELS[method] : null;
}
