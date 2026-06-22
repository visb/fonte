import { PayableController } from './payable.controller';

function svc() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'p1' }),
    findAll: jest.fn().mockResolvedValue([]),
    getSummary: jest.fn().mockResolvedValue({ total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: 'p1' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    pay: jest.fn().mockResolvedValue({ id: 'p1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    uploadAttachment: jest.fn().mockResolvedValue({ id: 'p1' }),
    removeAttachment: jest.fn().mockResolvedValue(undefined),
  };
}
const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('PayableController', () => {
  it('create passes the resolved userId', async () => {
    const s = svc();
    const c = new PayableController(s as never);
    await c.create({ description: 'Luz' } as never, { userId: 'u1' } as never);
    expect(s.create).toHaveBeenCalledWith({ description: 'Luz' }, 'u1');
  });

  it('create passes null when there is no userId', async () => {
    const s = svc();
    const c = new PayableController(s as never);
    await c.create({} as never, {} as never);
    expect(s.create).toHaveBeenCalledWith({}, null);
  });

  it('read/update/pay/remove and attachment routes delegate', async () => {
    const s = svc();
    const c = new PayableController(s as never);
    await c.findAll({} as never);
    await c.getSummary({} as never);
    await c.findOne('p1');
    await c.update('p1', { value: 1 } as never);
    await c.pay('p1', { paidAt: 'now' } as never, file);
    await c.remove('p1');
    await c.uploadAttachment('p1', file);
    await c.removeAttachment('p1');
    expect(s.findOne).toHaveBeenCalledWith('p1');
    expect(s.update).toHaveBeenCalledWith('p1', { value: 1 });
    expect(s.pay).toHaveBeenCalledWith('p1', { paidAt: 'now' }, file);
    expect(s.uploadAttachment).toHaveBeenCalledWith('p1', file);
    expect(s.removeAttachment).toHaveBeenCalledWith('p1');
  });
});
