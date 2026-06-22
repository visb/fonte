import { CensusController } from './census.controller';

function svc() {
  return {
    addResident: jest.fn().mockResolvedValue({ id: 'res1' }),
    conclude: jest.fn().mockResolvedValue({ done: true }),
    listPending: jest.fn().mockResolvedValue([]),
    approveAll: jest.fn().mockResolvedValue({ approved: 0 }),
    reject: jest.fn().mockResolvedValue({ id: 'res1' }),
  };
}
const user = { userId: 'u1' };

beforeEach(() => jest.clearAllMocks());

describe('CensusController', () => {
  it('routes pass the userId and ids to the service', async () => {
    const s = svc();
    const c = new CensusController(s as never);
    await c.addResident({ name: 'R' } as never, user as never);
    await c.conclude({ houseId: 'h1' } as never, user as never);
    await c.listPending('h1');
    await c.approveAll('h1');
    await c.reject('res1');
    expect(s.addResident).toHaveBeenCalledWith({ name: 'R' }, 'u1');
    expect(s.conclude).toHaveBeenCalledWith({ houseId: 'h1' }, 'u1');
    expect(s.approveAll).toHaveBeenCalledWith('h1');
    expect(s.reject).toHaveBeenCalledWith('res1');
  });
});
