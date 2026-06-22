import { Role } from '@fonte/types';
import { HouseController } from './house.controller';

function houseSvc() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'h1' }),
    create: jest.fn().mockResolvedValue({ id: 'h1' }),
    update: jest.fn().mockResolvedValue({ id: 'h1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    addPhoto: jest.fn().mockResolvedValue({ id: 'p1' }),
    removePhoto: jest.fn().mockResolvedValue(undefined),
    findResidents: jest.fn().mockResolvedValue([]),
    findStaffForHouse: jest.fn().mockResolvedValue([]),
    findRules: jest.fn().mockResolvedValue([]),
    createRule: jest.fn().mockResolvedValue({ id: 'r1' }),
    removeRule: jest.fn().mockResolvedValue(undefined),
  };
}
const ministrySvc = {
  findByHouse: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 'm1' }),
};
const file = { mimetype: 'image/png', buffer: Buffer.from('x') } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('HouseController', () => {
  it('CRUD + photos + residents/staff/rules delegate', async () => {
    const s = houseSvc();
    const c = new HouseController(s as never, ministrySvc as never);
    await c.findAll();
    await c.findOne('h1');
    await c.create({ name: 'Casa' } as never);
    await c.remove('h1');
    await c.addPhoto('h1', file);
    await c.removePhoto('h1', 'p1');
    await c.findResidents('h1');
    await c.findHouseStaff('h1');
    await c.findRules('h1');
    await c.createRule('h1', {} as never);
    await c.removeRule('h1', 'r1');
    expect(s.create).toHaveBeenCalledWith({ name: 'Casa' });
    expect(s.addPhoto).toHaveBeenCalledWith('h1', file);
    expect(s.findStaffForHouse).toHaveBeenCalledWith('h1');
  });

  it('update keeps capacity fields for ADMIN', async () => {
    const s = houseSvc();
    const c = new HouseController(s as never, ministrySvc as never);
    await c.update('h1', { generalCapacity: 10, staffCapacity: 2 } as never, { role: Role.ADMIN } as never);
    expect(s.update).toHaveBeenCalledWith('h1', { generalCapacity: 10, staffCapacity: 2 });
  });

  it('update strips capacity fields for COORDINATOR', async () => {
    const s = houseSvc();
    const c = new HouseController(s as never, ministrySvc as never);
    await c.update('h1', { name: 'x', generalCapacity: 10, staffCapacity: 2 } as never, { role: Role.COORDINATOR } as never);
    expect(s.update).toHaveBeenCalledWith('h1', { name: 'x' });
  });

  it('ministry endpoints delegate to the ministry service', async () => {
    const c = new HouseController(houseSvc() as never, ministrySvc as never);
    await c.findMinistries('h1');
    await c.createMinistry('h1', { name: 'Cozinha' } as never);
    expect(ministrySvc.findByHouse).toHaveBeenCalledWith('h1');
    expect(ministrySvc.create).toHaveBeenCalledWith('h1', { name: 'Cozinha' });
  });
});
