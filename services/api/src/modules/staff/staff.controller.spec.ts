import { BadRequestException } from '@nestjs/common';
import { StaffController } from './staff.controller';

function svc() {
  return {
    findByUserId: jest.fn().mockResolvedValue({ id: 's-me' }),
    updateMe: jest.fn().mockResolvedValue({ id: 's-me' }),
    uploadPhotoMe: jest.fn().mockResolvedValue({ id: 's-me' }),
    uploadSignatureMe: jest.fn().mockResolvedValue({ id: 's-me' }),
    uploadPhoto: jest.fn().mockResolvedValue({ id: 's1' }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 's1' }),
    create: jest.fn().mockResolvedValue({ id: 's1' }),
    update: jest.fn().mockResolvedValue({ id: 's1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    getPermissions: jest.fn().mockResolvedValue([]),
    addPermission: jest.fn().mockResolvedValue({ id: 'p1' }),
    removePermission: jest.fn().mockResolvedValue(undefined),
  };
}

function attSvc() {
  return {
    addAttachment: jest.fn().mockResolvedValue({ id: 'att1' }),
    listAttachments: jest.fn().mockResolvedValue([]),
    removeAttachment: jest.fn().mockResolvedValue(undefined),
  };
}

const user = { userId: 'u1', role: 'ADMIN' } as never;
const img = { mimetype: 'image/png', size: 10 } as Express.Multer.File;

describe('StaffController', () => {
  it('getMe delegates to findByUserId', async () => {
    const s = svc();
    await new StaffController(s as never, attSvc() as never).getMe(user);
    expect(s.findByUserId).toHaveBeenCalledWith('u1');
  });

  it('updateMe delegates with dto', async () => {
    const s = svc();
    await new StaffController(s as never, attSvc() as never).updateMe(user, { name: 'x' } as never);
    expect(s.updateMe).toHaveBeenCalledWith('u1', { name: 'x' });
  });

  it('uploadPhotoMe rejects a missing file', () => {
    expect(() => new StaffController(svc() as never, attSvc() as never).uploadPhotoMe(user, undefined)).toThrow(BadRequestException);
  });

  it('uploadPhotoMe rejects a non-image', () => {
    expect(() =>
      new StaffController(svc() as never, attSvc() as never).uploadPhotoMe(user, { mimetype: 'text/plain', size: 1 } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('uploadPhotoMe rejects a file over 5 MB', () => {
    expect(() =>
      new StaffController(svc() as never, attSvc() as never).uploadPhotoMe(user, { mimetype: 'image/png', size: 6 * 1024 * 1024 } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('uploadPhotoMe accepts a valid image', async () => {
    const s = svc();
    await new StaffController(s as never, attSvc() as never).uploadPhotoMe(user, img);
    expect(s.uploadPhotoMe).toHaveBeenCalledWith('u1', img);
  });

  // ─── Signature (story 128) ──────────────────────────────────────────────────

  it('uploadSignatureMe rejects a missing file', () => {
    expect(() => new StaffController(svc() as never, attSvc() as never).uploadSignatureMe(user, undefined)).toThrow(BadRequestException);
  });

  it('uploadSignatureMe rejects a non-PNG (transparency requires PNG)', () => {
    expect(() =>
      new StaffController(svc() as never, attSvc() as never).uploadSignatureMe(user, { mimetype: 'image/jpeg', size: 1 } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('uploadSignatureMe rejects a file over 5 MB', () => {
    expect(() =>
      new StaffController(svc() as never, attSvc() as never).uploadSignatureMe(user, { mimetype: 'image/png', size: 6 * 1024 * 1024 } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('uploadSignatureMe accepts a valid PNG and delegates', async () => {
    const s = svc();
    await new StaffController(s as never, attSvc() as never).uploadSignatureMe(user, img);
    expect(s.uploadSignatureMe).toHaveBeenCalledWith('u1', img);
  });

  it('findAll passes the caller scope', async () => {
    const s = svc();
    await new StaffController(s as never, attSvc() as never).findAll(user);
    expect(s.findAll).toHaveBeenCalledWith({ role: 'ADMIN', userId: 'u1' });
  });

  it('findOne / create / update / remove delegate', async () => {
    const s = svc();
    const c = new StaffController(s as never, attSvc() as never);
    await c.findOne('s1');
    await c.create({ name: 'x' } as never);
    await c.update('s1', { name: 'y' } as never);
    await c.remove('s1');
    expect(s.findOne).toHaveBeenCalledWith('s1');
    expect(s.create).toHaveBeenCalledWith({ name: 'x' });
    expect(s.update).toHaveBeenCalledWith('s1', { name: 'y' });
    expect(s.remove).toHaveBeenCalledWith('s1');
  });

  it('uploadPhoto validates and delegates', async () => {
    const s = svc();
    const c = new StaffController(s as never, attSvc() as never);
    expect(() => c.uploadPhoto('s1', undefined)).toThrow(BadRequestException);
    await c.uploadPhoto('s1', img);
    expect(s.uploadPhoto).toHaveBeenCalledWith('s1', img);
  });

  // ─── Attachments (story 98) ─────────────────────────────────────────────────

  it('uploadAttachment rejects a missing file and delegates with the author', async () => {
    const a = attSvc();
    const c = new StaffController(svc() as never, a as never);
    expect(() => c.uploadAttachment('s1', undefined, user)).toThrow(BadRequestException);
    const pdf = { mimetype: 'application/pdf', size: 10 } as Express.Multer.File;
    await c.uploadAttachment('s1', pdf, user);
    expect(a.addAttachment).toHaveBeenCalledWith('s1', pdf, 'u1');
  });

  it('listAttachments / removeAttachment delegate', async () => {
    const a = attSvc();
    const c = new StaffController(svc() as never, a as never);
    await c.listAttachments('s1');
    await c.removeAttachment('s1', 'att1');
    expect(a.listAttachments).toHaveBeenCalledWith('s1');
    expect(a.removeAttachment).toHaveBeenCalledWith('s1', 'att1');
  });

  it('permission endpoints delegate', async () => {
    const s = svc();
    const c = new StaffController(s as never, attSvc() as never);
    await c.getPermissions('s1');
    await c.addPermission('s1', { type: 'MODERATE_MESSAGES' } as never);
    await c.removePermission('s1', 'MODERATE_MESSAGES' as never);
    expect(s.getPermissions).toHaveBeenCalledWith('s1');
    expect(s.addPermission).toHaveBeenCalledWith('s1', 'MODERATE_MESSAGES');
    expect(s.removePermission).toHaveBeenCalledWith('s1', 'MODERATE_MESSAGES');
  });
});
