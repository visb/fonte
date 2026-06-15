/**
 * Normaliza texto para busca insensível a acento e caixa.
 * Ex: `normalizeForSearch('João')` === `normalizeForSearch('joao')`.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
