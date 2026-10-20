import { Role } from '@fonte/types';
import { HOUSE_COORDINATOR_ROLES, isHouseCoordinatorRole } from './house-coordinator';

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
