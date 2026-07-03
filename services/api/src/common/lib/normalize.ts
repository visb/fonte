/**
 * Normaliza um nome de pessoa para servir de chave de comparação insensível a
 * acento e caixa. Mesmo algoritmo do helper `normalizeForSearch` introduzido na
 * story 32 (busca de pessoas por nome sem acento) nos frontends, estendido com
 * `trim` e colapso de espaços — o backend não tinha um equivalente reutilizável.
 *
 * Ex.: `normalizeName('  José   ANTÔNIO ')` === `'jose antonio'`.
 */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}
