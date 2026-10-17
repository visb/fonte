import { REMOVABLE_RESIDENT_STATUSES, type ResidentStatus } from '@fonte/types';
import type { House } from '@fonte/api-client';

/**
 * Story 205 — filhos que podem entrar num ministério (ou liderá-lo): só os em
 * acolhimento (`REMOVABLE_RESIDENT_STATUSES`). A lista de entrada já é a da casa
 * do ministério (`GET /houses/:id/residents`), que inclui quem já saiu — foi
 * exatamente isso que o build antigo do `ops` mostrava. O backend valida de novo.
 */
export function ministryEligibleResidents<T extends { status: string }>(residents: T[]): T[] {
  return residents.filter((r) => REMOVABLE_RESIDENT_STATUSES.includes(r.status as ResidentStatus));
}

/**
 * Vagas para filhos numa casa.
 *
 * Servos ocupam primeiro a capacidade de servos; o excedente transborda para as
 * vagas de filhos. Filhos nunca ocupam vaga de servo. Por isso a vaga de filho
 * disponível desconta os servos que estouraram a capacidade de servos.
 *
 * Retorna `null` quando a casa não tem nenhuma capacidade definida.
 */
export function houseChildVacancies(house: House): number | null {
  const hasCapacity = house.generalCapacity != null || house.staffCapacity != null;
  if (!hasCapacity) return null;

  const childCapacity = house.generalCapacity ?? 0;
  const staffCapacity = house.staffCapacity ?? 0;
  const staffOverflow = Math.max(0, house.staffCount - staffCapacity);

  return Math.max(0, childCapacity - house.activeResidentsCount - staffOverflow);
}
