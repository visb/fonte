import { RESIDENT_CPF_IN_USE_CODE, type ResidentCpfConflictBody } from '@fonte/types';

type ApiError = { response?: { data?: { message?: string | string[] } } };

export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  const apiError = error as ApiError;
  const message = apiError?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}

/**
 * Story 218 (espelho do `getCpfConflict` do adm) — o 409 de CPF do filho em uso
 * (story 219): mensagem pronta e o id do dono, para a contagem oferecer o
 * reacolhimento. Outro erro → `null`.
 */
export function getCpfConflict(
  error: unknown,
): { message: string; conflictResidentId: string | null } | null {
  const data = (error as { response?: { data?: Partial<ResidentCpfConflictBody> } } | null)
    ?.response?.data;
  if (data?.code !== RESIDENT_CPF_IN_USE_CODE) return null;
  return {
    message: getErrorMessage(error, 'Já existe um filho com este CPF.'),
    conflictResidentId: data.conflictResidentId ?? null,
  };
}
