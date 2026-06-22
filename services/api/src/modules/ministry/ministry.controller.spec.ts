import { MinistryController } from './ministry.controller';

function svc() {
  return {
    findOne: jest.fn().mockResolvedValue({ id: 'm1' }),
    update: jest.fn().mockResolvedValue({ id: 'm1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    addResident: jest.fn().mockResolvedValue(undefined),
    removeResident: jest.fn().mockResolvedValue(undefined),
    addStaff: jest.fn().mockResolvedValue(undefined),
    removeStaff: jest.fn().mockResolvedValue(undefined),
    findTasks: jest.fn().mockResolvedValue([]),
    createTask: jest.fn().mockResolvedValue({ id: 't1' }),
    updateTask: jest.fn().mockResolvedValue({ id: 't1' }),
    removeTask: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('MinistryController', () => {
  it('group/member/task routes delegate to the service', async () => {
    const s = svc();
    const c = new MinistryController(s as never);
    await c.findOne('m1');
    await c.update('m1', { name: 'x' } as never);
    await c.remove('m1');
    await c.addResident('m1', { residentId: 'res1' } as never);
    await c.removeResident('m1', 'res1');
    await c.addStaff('m1', { staffId: 'st1' } as never);
    await c.removeStaff('m1', 'st1');
    await c.findTasks('m1');
    await c.createTask('m1', { title: 'T' } as never);
    await c.updateTask('m1', 't1', { title: 'U' } as never);
    await c.removeTask('m1', 't1');
    expect(s.addResident).toHaveBeenCalledWith('m1', 'res1');
    expect(s.addStaff).toHaveBeenCalledWith('m1', 'st1');
    expect(s.updateTask).toHaveBeenCalledWith('m1', 't1', { title: 'U' });
  });
});
