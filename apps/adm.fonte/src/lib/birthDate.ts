import { z } from 'zod';
import {
  isAdultBirthDate,
  maxBirthDateFor,
  MIN_AGE_MESSAGE,
  todayInSaoPaulo,
} from '@fonte/types';

/**
 * Story 202 — filho e servo só com 18 anos completos hoje (fuso de São Paulo).
 * A regra é a de `@fonte/types`, a mesma que o backend aplica com 400.
 *
 * Só julga a data informada agora: vazio passa (campo opcional) e, na edição,
 * a data igual à carregada passa — senão a tela bloquearia uma ficha legada
 * que o backend aceita salvar.
 */
export function birthDateError(
  value: string | null | undefined,
  initial?: string | null,
  today: string = todayInSaoPaulo(),
): string | null {
  if (!value) return null;
  const next = value.slice(0, 10);
  if (initial && initial.slice(0, 10) === next) return null;
  return isAdultBirthDate(next, today) ? null : MIN_AGE_MESSAGE;
}

/** Maior nascimento aceito hoje — `max` do calendário. */
export function maxBirthDate(today: string = todayInSaoPaulo()): string {
  return maxBirthDateFor(today);
}

/**
 * Campo zod de nascimento opcional com a regra de maioridade. `initial` é a
 * data carregada na edição (ou nada, na criação).
 */
export function birthDateField(initial?: string | null) {
  return z
    .string()
    .optional()
    .refine((v) => birthDateError(v, initial) === null, { message: MIN_AGE_MESSAGE });
}
