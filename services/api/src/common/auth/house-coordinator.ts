import { Role } from '@fonte/types';

/**
 * Story 214 — "coordenador da casa" é COORDINATOR **ou** ADMIN lotado nela.
 * A lotação (`staff.house_id`) continua sendo o vínculo: este predicado só diz
 * se a role pode coordenar uma casa. Admin sem `house_id` não coordena nenhuma.
 * Um predicado só para toda a API — não espalhar `role === COORDINATOR || ...`.
 */
export const HOUSE_COORDINATOR_ROLES: readonly Role[] = [Role.COORDINATOR, Role.ADMIN];

export function isHouseCoordinatorRole(role: string | null | undefined): boolean {
  return HOUSE_COORDINATOR_ROLES.includes(role as Role);
}
