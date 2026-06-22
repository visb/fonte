import { ActivityController } from './activity.controller';

function svc() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'a1' }),
    listEvents: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'a1' }),
    update: jest.fn().mockResolvedValue({ id: 'a1' }),
    changeStatus: jest.fn().mockResolvedValue({ id: 'a1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}
const user = { userId: 'u1', role: 'ADMIN' };

beforeEach(() => jest.clearAllMocks());

describe('ActivityController', () => {
  it('routes pass the current user and dto/filters', async () => {
    const s = svc();
    const c = new ActivityController(s as never);
    await c.findAll({ status: 'DOING' } as never, user as never);
    await c.findOne('a1', user as never);
    await c.listEvents('a1', user as never);
    await c.create({ title: 'A' } as never, user as never);
    await c.update('a1', { title: 'X' } as never, user as never);
    await c.changeStatus('a1', { status: 'DONE' } as never, user as never);
    await c.remove('a1', user as never);
    expect(s.findAll).toHaveBeenCalledWith(user, { status: 'DOING' });
    expect(s.create).toHaveBeenCalledWith({ title: 'A' }, user);
    expect(s.changeStatus).toHaveBeenCalledWith('a1', { status: 'DONE' }, user);
  });
});
