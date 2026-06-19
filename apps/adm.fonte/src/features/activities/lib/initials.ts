/**
 * Deriva as iniciais de um nome para exibir no avatar do responsável.
 * - Pega a primeira letra do primeiro e do último termo significativo.
 * - Ignora termos vazios (espaços extras) e normaliza para maiúsculas.
 * - Retorna string vazia quando não há letra alguma para derivar.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
