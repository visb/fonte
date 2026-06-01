import type { House } from '@fonte/api-client';

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
