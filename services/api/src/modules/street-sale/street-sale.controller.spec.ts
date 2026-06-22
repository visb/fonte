import { StreetSaleType } from '@fonte/types';
import { StreetSaleController } from './street-sale.controller';

function svc() {
  return {
    create: jest.fn().mockResolvedValue({ id: 's1' }),
    findAll: jest.fn().mockResolvedValue([]),
    getReport: jest.fn().mockResolvedValue({ total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: 's1' }),
    update: jest.fn().mockResolvedValue({ id: 's1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('StreetSaleController', () => {
  it('routes delegate to the service, create passes the userId', async () => {
    const s = svc();
    const c = new StreetSaleController(s as never);
    await c.create({ amountCents: 100 } as never, { userId: 'u1' } as never);
    await c.findAll('h1', StreetSaleType.BREAD);
    await c.getReport({} as never);
    await c.findOne('s1');
    await c.update('s1', { amountCents: 200 } as never);
    await c.remove('s1');
    expect(s.create).toHaveBeenCalledWith({ amountCents: 100 }, 'u1');
    expect(s.findAll).toHaveBeenCalledWith('h1', StreetSaleType.BREAD);
  });
});
