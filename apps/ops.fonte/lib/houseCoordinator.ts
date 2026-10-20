import { Role } from '@fonte/types';

/**
 * Story 214 — espelho do `isHouseCoordinatorRole` da API: "coordenador da casa"
 * é COORDINATOR **ou** ADMIN lotado nela. Este predicado só diz se a role pode
 * coordenar; o vínculo (`staff.houseId === house.id`) continua sendo checado por
 * quem chama. Um predicado só — não espalhar `role === COORDINATOR || ...`.
 */
const HOUSE_COORDINATOR_ROLES: readonly string[] = [Role.COORDINATOR, Role.ADMIN];

export function isHouseCoordinatorRole(role: string | null | undefined): boolean {
  return !!role && HOUSE_COORDINATOR_ROLES.includes(role);
}
