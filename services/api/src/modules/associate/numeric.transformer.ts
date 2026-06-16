import { ValueTransformer } from 'typeorm';

/** Converte colunas PostgreSQL `numeric` (devolvidas como string) em number e vice-versa. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};
