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

/** 'YYYY-MM' → 'Mai/26'. */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
