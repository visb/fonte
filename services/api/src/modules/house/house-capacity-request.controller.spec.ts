import { Role } from '@fonte/types';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { HouseCapacityRequestController } from './house-capacity-request.controller';

function svc() {
  return {
    createRequest: jest.fn().mockResolvedValue({ id: 'cr1' }),
    listForHouse: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue({ id: 'cr1' }),
    approve: jest.fn().mockResolvedValue({ id: 'cr1' }),
    reject: jest.fn().mockResolvedValue({ id: 'cr1' }),
  };
}
const user = { userId: 'u1' };

beforeEach(() => jest.clearAllMocks());

describe('HouseCapacityRequestController', () => {
  it('routes pass the userId and ids to the service', async () => {
    const s = svc();
    const c = new HouseCapacityRequestController(s as never);
    await c.create('h1', { generalCapacity: 5 } as never, user as never);
    await c.list('h1');
    await c.getOne('cr1');
    await c.approve('cr1', user as never);
    await c.reject('cr1', user as never);
    expect(s.createRequest).toHaveBeenCalledWith('h1', { generalCapacity: 5 }, 'u1');
    expect(s.approve).toHaveBeenCalledWith('cr1', 'u1');
    expect(s.reject).toHaveBeenCalledWith('cr1', 'u1');
  });

  // Story 214: ADMIN lotado na casa também é coordenador dela.
  it('POST de pedido aceita COORDINATOR e ADMIN; revisão segue só ADMIN', () => {
    const roles = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);
    const proto = HouseCapacityRequestController.prototype;
    expect(roles(proto.create)).toEqual([Role.COORDINATOR, Role.ADMIN]);
    expect(roles(proto.approve)).toEqual([Role.ADMIN]);
    expect(roles(proto.reject)).toEqual([Role.ADMIN]);
  });
});
