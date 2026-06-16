const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata um valor em CENTAVOS como moeda (R$). */
export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** Converte reais (number) para centavos (inteiro), arredondando. */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/** Converte centavos para reais (number) para edição em formulário. */
export function centsToReais(cents: number): number {
  return cents / 100;
}
