import { IncidentController } from './incident.controller';

function svc() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'i1' }),
    create: jest.fn().mockResolvedValue({ id: 'i1' }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('IncidentController', () => {
  it('routes delegate to the service (no delete endpoint exists)', async () => {
    const s = svc();
    const c = new IncidentController(s as never);
    await c.findAll('h1', 'res1');
    await c.findOne('i1');
    await c.create({ description: 'x' } as never);
    expect(s.findAll).toHaveBeenCalledWith('h1', 'res1');
    expect(s.findOne).toHaveBeenCalledWith('i1');
    expect(s.create).toHaveBeenCalledWith({ description: 'x' });
    expect((c as unknown as Record<string, unknown>).remove).toBeUndefined();
  });
});
