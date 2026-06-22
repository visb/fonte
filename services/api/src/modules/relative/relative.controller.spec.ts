import { BadRequestException } from '@nestjs/common';
import { Role } from '@fonte/types';
import { RelativeController } from './relative.controller';

function svc() {
  return {
    findMe: jest.fn().mockResolvedValue({ id: 'r1' }),
    updateMe: jest.fn().mockResolvedValue({ id: 'r1' }),
    uploadPhoto: jest.fn().mockResolvedValue({ id: 'r1' }),
    findByResident: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'r1' }),
    setResponsible: jest.fn().mockResolvedValue({ id: 'r1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    generateAccess: jest.fn().mockResolvedValue({ id: 'r1' }),
    resetPassword: jest.fn().mockResolvedValue(undefined),
  };
}
const img = { mimetype: 'image/png', size: 100, buffer: Buffer.from('x') } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('RelativeController', () => {
  it('self-service (me) routes delegate with userId', async () => {
    const s = svc();
    const c = new RelativeController(s as never);
    await c.findMe({ userId: 'u1' } as never);
    await c.updateMe({ userId: 'u1' } as never, { name: 'x' } as never);
    await c.uploadPhoto({ userId: 'u1' } as never, img);
    expect(s.findMe).toHaveBeenCalledWith('u1');
    expect(s.updateMe).toHaveBeenCalledWith('u1', { name: 'x' });
    expect(s.uploadPhoto).toHaveBeenCalledWith('u1', img);
  });

  it('uploadPhoto rejects missing file, non-image and oversize', () => {
    const c = new RelativeController(svc() as never);
    expect(() => c.uploadPhoto({ userId: 'u1' } as never, undefined)).toThrow(BadRequestException);
    expect(() =>
      c.uploadPhoto({ userId: 'u1' } as never, { mimetype: 'text/plain', size: 1 } as never),
    ).toThrow(BadRequestException);
    expect(() =>
      c.uploadPhoto({ userId: 'u1' } as never, { mimetype: 'image/png', size: 6 * 1024 * 1024 } as never),
    ).toThrow(BadRequestException);
  });

  it('admin routes delegate with scope/dto', async () => {
    const s = svc();
    const c = new RelativeController(s as never);
    await c.findByResident('res1', { role: Role.SERVANT, userId: 'u1' } as never);
    await c.create({ name: 'x' } as never);
    await c.setResponsible('r1');
    await c.remove('r1');
    await c.generateAccess('r1', { email: 'a@b.com', password: 'pw' } as never);
    await c.resetPassword('r1', { password: 'pw2' } as never);
    expect(s.findByResident).toHaveBeenCalledWith('res1', { role: Role.SERVANT, userId: 'u1' });
    expect(s.generateAccess).toHaveBeenCalledWith('r1', 'a@b.com', 'pw');
    expect(s.resetPassword).toHaveBeenCalledWith('r1', 'pw2');
  });
});
