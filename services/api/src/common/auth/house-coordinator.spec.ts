import { Role } from '@fonte/types';
import { HOUSE_COORDINATOR_ROLES, isActiveHouseCoordinator, isHouseCoordinatorRole } from './house-coordinator';

describe('isHouseCoordinatorRole (story 214)', () => {
  it('aceita COORDINATOR e ADMIN', () => {
    expect(isHouseCoordinatorRole(Role.COORDINATOR)).toBe(true);
    expect(isHouseCoordinatorRole(Role.ADMIN)).toBe(true);
  });

  it('recusa as demais roles e valores vazios', () => {
    expect(isHouseCoordinatorRole(Role.SERVANT)).toBe(false);
    expect(isHouseCoordinatorRole(Role.RELATIVE)).toBe(false);
    expect(isHouseCoordinatorRole(Role.RESIDENT)).toBe(false);
    expect(isHouseCoordinatorRole(undefined)).toBe(false);
    expect(isHouseCoordinatorRole(null)).toBe(false);
  });

  it('expõe a lista usada nas queries', () => {
    expect([...HOUSE_COORDINATOR_ROLES]).toEqual([Role.COORDINATOR, Role.ADMIN]);
  });
});

describe('isActiveHouseCoordinator (story 217)', () => {
  it('exige role de coordenação e servo ativo', () => {
    expect(isActiveHouseCoordinator({ role: Role.ADMIN })).toBe(true);
    expect(isActiveHouseCoordinator({ role: Role.COORDINATOR, deletedAt: null, dismissedAt: null })).toBe(true);
  });

  it('recusa desligado, soft-deletado e role sem coordenação', () => {
    expect(isActiveHouseCoordinator({ role: Role.COORDINATOR, dismissedAt: '2026-01-01' })).toBe(false);
    expect(isActiveHouseCoordinator({ role: Role.ADMIN, deletedAt: new Date() })).toBe(false);
    expect(isActiveHouseCoordinator({ role: Role.SERVANT })).toBe(false);
  });
});
