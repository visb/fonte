import { z } from 'zod';
import type { FieldError, FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { INVALID_CPF_MESSAGE, isValidCpf, normalizeCpf } from '@fonte/types';
import { getCpfConflict } from './errors';

/**
 * Story 219 — CPF do filho no formulário: máscara só na digitação, dígitos no
 * payload, DV julgado só quando o valor muda (`initial` é o CPF carregado na
 * edição — ficha legada com CPF inválido continua salvável).
 */
export function cpfField(initial?: string | null) {
  const initialDigits = normalizeCpf(initial);
  return z
    .string()
    .optional()
    .refine(
      (value) => {
        const digits = normalizeCpf(value);
        if (!digits) return true;
        if (value?.includes('*')) return true; // redigido pelo backend: não é escrita
        if (initialDigits && digits === initialDigits) return true;
        return isValidCpf(digits);
      },
      { message: INVALID_CPF_MESSAGE },
    );
}

/**
 * Valor do CPF no payload: dígitos ou `null` (vazio limpa). Valor redigido
 * (`***.***.789-00`) devolve `undefined` — o campo sai do payload em vez de
 * gravar um CPF derivado do redigido.
 */
export function cpfPayloadValue(value?: string | null): string | null | undefined {
  if (value?.includes('*')) return undefined;
  return normalizeCpf(value);
}

/** `type` do erro de campo que carrega o filho dono do CPF (link "Ver cadastro"). */
export const CPF_CONFLICT_ERROR_TYPE = 'cpfConflict';

/**
 * 409 de CPF em uso → erro no campo `cpf` com o id do dono em `types`.
 * Devolve `true` quando tratou (o chamador não mostra o erro genérico).
 */
export function applyCpfConflict<T extends FieldValues & { cpf?: string }>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  const conflict = getCpfConflict(error);
  if (!conflict) return false;
  setError('cpf' as Path<T>, {
    type: CPF_CONFLICT_ERROR_TYPE,
    message: conflict.message,
    types: conflict.conflictResidentId ? { [CPF_CONFLICT_ERROR_TYPE]: conflict.conflictResidentId } : undefined,
  });
  return true;
}

/** Id do filho dono do CPF guardado no erro do campo, quando houver. */
export function cpfConflictIdOf(error?: FieldError): string | null {
  if (error?.type !== CPF_CONFLICT_ERROR_TYPE) return null;
  const id = error.types?.[CPF_CONFLICT_ERROR_TYPE];
  return typeof id === 'string' ? id : null;
}
