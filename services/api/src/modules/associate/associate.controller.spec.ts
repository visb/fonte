import { AssociateController } from './associate.controller';

function svc() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'a1' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getOverview: jest.fn().mockResolvedValue({ months: [] }),
    findOne: jest.fn().mockResolvedValue({ id: 'a1' }),
    update: jest.fn().mockResolvedValue({ id: 'a1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}
function paymentSvc() {
  return { cancelSubscription: jest.fn().mockResolvedValue({ id: 'a1' }) };
}

beforeEach(() => jest.clearAllMocks());

describe('AssociateController', () => {
  it('CRUD + overview delegate to the associate service', async () => {
    const s = svc();
    const c = new AssociateController(s as never, paymentSvc() as never);
    await c.create({ name: 'A' } as never);
    await c.findAll({ limit: 10, offset: 5 } as never);
    await c.getOverview(6);
    await c.findOne('a1');
    await c.update('a1', { name: 'X' } as never);
    await c.remove('a1');
    expect(s.findAll).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    expect(s.getOverview).toHaveBeenCalledWith(6);
  });

  it('cancelSubscription delegates to the payment service', async () => {
    const p = paymentSvc();
    const c = new AssociateController(svc() as never, p as never);
    await c.cancelSubscription('a1');
    expect(p.cancelSubscription).toHaveBeenCalledWith('a1');
  });
});
