import { IsNull } from 'typeorm';

/**
 * Story 217 — predicado único de servo **ativo**: não soft-deletado e não
 * desligado (`deleted_at IS NULL AND dismissed_at IS NULL`). Toda lista,
 * contagem ou seletor de servo ativo usa estes helpers — não repetir o par de
 * colunas à mão.
 */

/** Fragmento SQL para queries cruas (`WHERE`/`JOIN ... ON`), com o alias da tabela `staff`. */
export function activeStaffSql(alias: string): string {
  return `${alias}.deleted_at IS NULL AND ${alias}.dismissed_at IS NULL`;
}

/**
 * Filtro para `find`/`count` do TypeORM. O `deleted_at` já é aplicado pelo
 * TypeORM (`@DeleteDateColumn`); aqui entra só o desligamento.
 */
export const ACTIVE_STAFF_WHERE = { dismissedAt: IsNull() } as const;

/** Mesmo predicado sobre um registro já carregado. */
export function isActiveStaff(staff: {
  deletedAt?: Date | string | null;
  dismissedAt?: Date | string | null;
}): boolean {
  return !staff.deletedAt && !staff.dismissedAt;
}
