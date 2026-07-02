import { EventController } from './event.controller';

function eventSvc() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'e1' }),
    findAll: jest.fn().mockResolvedValue([]),
    listInternal: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'e1' }),
    update: jest.fn().mockResolvedValue({ id: 'e1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    uploadBanner: jest.fn().mockResolvedValue({ id: 'e1' }),
  };
}
function regSvc() {
  return {
    listRegistrations: jest.fn().mockResolvedValue([]),
    resendPaymentLink: jest.fn().mockResolvedValue({ email: false, whatsapp: false }),
    deleteRegistration: jest.fn().mockResolvedValue(undefined),
  };
}
function inviteSvc() {
  return {
    inviteStaff: jest.fn().mockResolvedValue({ sent: [], skipped: [] }),
  };
}
const file = { mimetype: 'image/png', buffer: Buffer.from('x') } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('EventController', () => {
  it('event CRUD + banner delegate to the event service', async () => {
    const s = eventSvc();
    const c = new EventController(s as never, regSvc() as never, inviteSvc() as never);
    await c.create({ title: 'E' } as never);
    await c.findAll({} as never);
    await c.listInternal();
    await c.findOne('e1');
    await c.update('e1', { title: 'X' } as never);
    await c.remove('e1');
    await c.uploadBanner('e1', file);
    expect(s.create).toHaveBeenCalledWith({ title: 'E' });
    expect(s.listInternal).toHaveBeenCalled();
    expect(s.uploadBanner).toHaveBeenCalledWith('e1', file);
  });

  it('registration routes delegate to the registration service', async () => {
    const r = regSvc();
    const c = new EventController(eventSvc() as never, r as never, inviteSvc() as never);
    await c.listRegistrations('e1');
    await c.resendPaymentLink('e1', 'reg1');
    await c.deleteRegistration('e1', 'reg1');
    expect(r.listRegistrations).toHaveBeenCalledWith('e1');
    expect(r.resendPaymentLink).toHaveBeenCalledWith('e1', 'reg1');
    expect(r.deleteRegistration).toHaveBeenCalledWith('e1', 'reg1');
  });

  it('invite-staff delegates to the invite service (story 95)', async () => {
    const i = inviteSvc();
    const c = new EventController(eventSvc() as never, regSvc() as never, i as never);
    const result = await c.inviteStaff('e1', { staffIds: ['s1', 's2'] });
    expect(i.inviteStaff).toHaveBeenCalledWith('e1', ['s1', 's2']);
    expect(result).toEqual({ sent: [], skipped: [] });
  });
});
