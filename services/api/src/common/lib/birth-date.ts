import { BadRequestException } from '@nestjs/common';
import { isAdultBirthDate, MIN_AGE_MESSAGE, todayInSaoPaulo } from '@fonte/types';

type BirthDateValue = string | Date | null | undefined;

/** `YYYY-MM-DD` de um valor de data vindo do DTO (string) ou da entidade. */
function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/**
 * Story 202 — filho e servo só com 18 anos completos **hoje** (fuso de São
 * Paulo). Só julga a data quando ela foi informada agora: nulo/vazio passa
 * (o campo é opcional) e, na edição, a data igual à gravada passa — cadastro
 * antigo com digitação errada continua salvável quando se mexe em outro campo.
 *
 * Chamar **antes** de persistir e de qualquer efeito colateral.
 */
export function assertAdultBirthDate(
  next: BirthDateValue,
  previous?: BirthDateValue,
  today: string = todayInSaoPaulo(),
): void {
  if (!next) return;
  const nextIso = toIsoDate(next);
  if (previous && toIsoDate(previous) === nextIso) return;
  if (!isAdultBirthDate(nextIso, today)) {
    throw new BadRequestException(MIN_AGE_MESSAGE);
  }
}
