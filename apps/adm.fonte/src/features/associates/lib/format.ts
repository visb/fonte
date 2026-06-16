const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata um valor em reais (R$). */
export function formatBRL(value: number): string {
  return currencyFormatter.format(value);
}

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/** Formata uma taxa 0..1 como porcentagem. */
export function formatPercent(rate: number): string {
  return percentFormatter.format(rate);
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Formata uma data ISO ('2026-06-16' ou ISO completo) como 'dd/mm/aaaa' (pt-BR). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Datas 'YYYY-MM-DD' viram UTC à meia-noite; força meio-dia p/ evitar voltar 1 dia.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFormatter.format(d);
}

/** 'YYYY-MM' → 'Mai/26'. */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
