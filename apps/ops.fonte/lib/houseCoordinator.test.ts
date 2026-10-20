import { Role } from '@fonte/types';
import { isHouseCoordinatorRole } from './houseCoordinator';

describe('isHouseCoordinatorRole (story 214)', () => {
  it('aceita COORDINATOR e ADMIN', () => {
    expect(isHouseCoordinatorRole(Role.COORDINATOR)).toBe(true);
    expect(isHouseCoordinatorRole(Role.ADMIN)).toBe(true);
  });

  it('recusa SERVANT e valores vazios', () => {
    expect(isHouseCoordinatorRole(Role.SERVANT)).toBe(false);
    expect(isHouseCoordinatorRole(undefined)).toBe(false);
    expect(isHouseCoordinatorRole(null)).toBe(false);
  });
});
