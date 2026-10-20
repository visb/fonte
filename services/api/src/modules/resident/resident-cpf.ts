import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  INVALID_CPF_MESSAGE,
  isValidCpf,
  normalizeCpf,
  RESIDENT_CPF_IN_USE_CODE,
  ResidentCpfConflictBody,
  ResidentStatus,
} from '@fonte/types';

/**
 * Story 219 — CPF do filho é único entre filhos não excluídos. A checagem do
 * service devolve o 409 amigável; o índice `UX_residents_cpf_active` é a
 * garantia contra corrida e contra a fila offline do `ops`.
 */
export const RESIDENT_CPF_UNIQUE_INDEX = 'UX_residents_cpf_active';

/** Qualquer coisa com `.query` — `DataSource` ou o `EntityManager` da transação. */
export interface CpfQueryRunner {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
}

const STATUS_LABELS: Record<ResidentStatus, string> = {
  [ResidentStatus.PRE_ADMISSION]: 'Pré-admissão',
  [ResidentStatus.ACTIVE]: 'Ativo',
  [ResidentStatus.DISCIPLINE]: 'Disciplina',
  [ResidentStatus.TEMP_LEAVE]: 'Saída temporária',
  [ResidentStatus.DISCHARGED]: 'Alta',
  [ResidentStatus.EVADED]: 'Evasão',
  [ResidentStatus.CENSUS_ADDED]: 'Adicionado na contagem',
  [ResidentStatus.REJECTED_CENSUS]: 'Recusado na contagem',
  [ResidentStatus.ARCHIVED]: 'Arquivado',
};

interface CpfOwner {
  id: string;
  name: string;
  status: ResidentStatus;
}

/** Corpo do 409 (decisão 9): nome + status do dono atual e o id para linkar. */
export function cpfConflictException(owner: CpfOwner | null): ConflictException {
  const body: ResidentCpfConflictBody = {
    statusCode: 409,
    error: 'Conflict',
    code: RESIDENT_CPF_IN_USE_CODE,
    message: owner
      ? `Já existe um filho com este CPF: ${owner.name} (${STATUS_LABELS[owner.status] ?? owner.status}).`
      : 'Já existe um filho com este CPF.',
    conflictResidentId: owner?.id ?? null,
  };
  return new ConflictException(body);
}

/** Dono (não excluído) do CPF, fora `exceptId`. Consulta pelo índice único. */
export async function findCpfOwner(
  runner: CpfQueryRunner,
  cpf: string,
  exceptId?: string,
): Promise<CpfOwner | null> {
  const rows = await runner.query<CpfOwner[]>(
    `SELECT id, name, status FROM residents
      WHERE cpf = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1`,
    [cpf, exceptId ?? null],
  );
  return rows[0] ?? null;
}

/** 409 se outro filho não excluído já tem o CPF. CPF nulo/ausente não é julgado. */
export async function assertCpfAvailable(
  runner: CpfQueryRunner,
  cpf: string | null | undefined,
  exceptId?: string,
): Promise<void> {
  const digits = normalizeCpf(cpf);
  if (!digits) return;
  const owner = await findCpfOwner(runner, digits, exceptId);
  if (owner) throw cpfConflictException(owner);
}

/**
 * Edição (decisão 3): só julga quando o CPF muda. Devolve `true` se o CPF
 * novo precisa da checagem de unicidade. Mudar para inválido → 400.
 */
export function assertCpfChange(next: string | null | undefined, previous: string | null | undefined): boolean {
  if (next === undefined) return false;
  const digits = normalizeCpf(next);
  if (digits === normalizeCpf(previous)) return false;
  if (digits === null) return false;
  if (!isValidCpf(digits)) throw new BadRequestException(INVALID_CPF_MESSAGE);
  return true;
}

/** Violação do índice único de CPF (Postgres `23505`) — a corrida perdida. */
export function isCpfUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
  const code = err?.code ?? err?.driverError?.code;
  const constraint = err?.constraint ?? err?.driverError?.constraint;
  return code === '23505' && constraint === RESIDENT_CPF_UNIQUE_INDEX;
}

/**
 * Converte a violação do índice no mesmo 409 da checagem; qualquer outro erro
 * sobe intacto. A releitura do dono usa `runner` fora da transação abortada.
 */
export async function rethrowCpfViolation(
  error: unknown,
  runner: CpfQueryRunner,
  cpf: string | null | undefined,
  exceptId?: string,
): Promise<never> {
  if (!isCpfUniqueViolation(error)) throw error;
  const digits = normalizeCpf(cpf);
  const owner = digits ? await findCpfOwner(runner, digits, exceptId).catch(() => null) : null;
  throw cpfConflictException(owner);
}
