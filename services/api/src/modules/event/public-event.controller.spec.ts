import { PublicEventController } from './public-event.controller';

function svc() {
  return {
    listPublic: jest.fn().mockResolvedValue([]),
    getPublicView: jest.fn().mockResolvedValue({ id: 'e1' }),
    register: jest.fn().mockResolvedValue({ id: 'reg1' }),
    uploadRegistrationFile: jest.fn().mockResolvedValue({ fileKey: 'k' }),
  };
}
const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('PublicEventController', () => {
  it('public routes delegate to the registration service', async () => {
    const s = svc();
    const c = new PublicEventController(s as never);
    await c.list();
    await c.getOne('e1');
    await c.register('e1', { name: 'Joao' } as never);
    await c.uploadRegistrationFile('e1', file);
    expect(s.getPublicView).toHaveBeenCalledWith('e1');
    expect(s.register).toHaveBeenCalledWith('e1', { name: 'Joao' });
    expect(s.uploadRegistrationFile).toHaveBeenCalledWith('e1', file);
  });
});
