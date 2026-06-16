import { z } from 'zod';

/** Valor de uma célula de nota: vazio (null) ou número 0–10 com até 2 casas. */
export const gradeCellSchema = z
  .union([z.literal(''), z.coerce.number().min(0, 'Nota deve ser entre 0 e 10').max(10, 'Nota deve ser entre 0 e 10')])
  .transform((v) => (v === '' ? null : v));

/** Faz o parse de um texto de célula. Retorna { value } ou { error }. */
export function parseGradeCell(raw: string): { value: number | null } | { error: string } {
  const trimmed = raw.trim().replace(',', '.');
  const result = gradeCellSchema.safeParse(trimmed);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Nota inválida' };
  }
  return { value: result.data };
}

export function formatGrade(value: number | null): string {
  if (value === null) return '';
  return String(value);
}

export function formatAverage(value: number | null): string {
  if (value === null) return '–';
  return value.toFixed(1).replace('.', ',');
}
