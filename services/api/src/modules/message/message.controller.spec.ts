import { BadRequestException } from '@nestjs/common';
import { MessageController } from './message.controller';

function svc() {
  return {
    getConversations: jest.fn().mockResolvedValue([]),
    getMyConversations: jest.fn().mockResolvedValue([]),
    getThread: jest.fn().mockResolvedValue([]),
    getPending: jest.fn().mockResolvedValue([]),
    send: jest.fn().mockResolvedValue({ id: 'm1' }),
    getHouseStaffThreads: jest.fn().mockResolvedValue([]),
    getDirectConversations: jest.fn().mockResolvedValue([]),
    getDirectThread: jest.fn().mockResolvedValue([]),
    sendDirect: jest.fn().mockResolvedValue({ id: 'm1' }),
    approve: jest.fn().mockResolvedValue({ id: 'm1' }),
    reject: jest.fn().mockResolvedValue({ id: 'm1' }),
  };
}
function storage() {
  return {
    uniqueFilename: jest.fn().mockReturnValue('u-file'),
    upload: jest.fn().mockResolvedValue('http://x/u-file'),
  };
}

const user = { userId: 'u1', role: 'ADMIN', profileType: 'STAFF' } as never;

describe('MessageController', () => {
  it('read endpoints delegate with caller identity', async () => {
    const s = svc();
    const c = new MessageController(s as never, storage() as never);
    await c.getConversations(user);
    await c.getMyConversations(user);
    await c.getThread(user, 'res-1', 'rel-1');
    await c.getPending(user);
    await c.getHouseStaffThreads(user);
    await c.getDirectConversations(user);
    await c.getDirectThread(user, 's1', 'rel-1');
    expect(s.getConversations).toHaveBeenCalledWith('u1', 'ADMIN');
    expect(s.getThread).toHaveBeenCalledWith('u1', 'ADMIN', 'res-1', 'rel-1');
    expect(s.getDirectThread).toHaveBeenCalledWith('u1', 'ADMIN', 's1', 'rel-1');
  });

  it('send / sendDirect pass profileType', async () => {
    const s = svc();
    const c = new MessageController(s as never, storage() as never);
    await c.send(user, { content: 'oi' } as never);
    await c.sendDirect(user, { content: 'oi' } as never);
    expect(s.send).toHaveBeenCalledWith('u1', 'STAFF', { content: 'oi' });
    expect(s.sendDirect).toHaveBeenCalledWith('u1', 'STAFF', { content: 'oi' });
  });

  it('approve / reject delegate', async () => {
    const s = svc();
    const c = new MessageController(s as never, storage() as never);
    await c.approve(user, 'm1');
    await c.reject(user, 'm1');
    expect(s.approve).toHaveBeenCalledWith('u1', 'm1');
    expect(s.reject).toHaveBeenCalledWith('u1', 'm1');
  });

  describe('uploadAttachment', () => {
    it('rejects a missing file', async () => {
      const c = new MessageController(svc() as never, storage() as never);
      await expect(c.uploadAttachment(undefined as never)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a disallowed mimetype', async () => {
      const c = new MessageController(svc() as never, storage() as never);
      await expect(
        c.uploadAttachment({ mimetype: 'application/x-evil', originalname: 'e', buffer: Buffer.from('x') } as Express.Multer.File),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('classifies an image and uploads it', async () => {
      const st = storage();
      const c = new MessageController(svc() as never, st as never);
      const out = await c.uploadAttachment({ mimetype: 'image/png', originalname: 'a.png', buffer: Buffer.from('x') } as Express.Multer.File);
      expect(out).toEqual({ url: 'http://x/u-file', type: 'image' });
      expect(st.upload).toHaveBeenCalled();
    });

    it('classifies audio and documents', async () => {
      const c = new MessageController(svc() as never, storage() as never);
      expect((await c.uploadAttachment({ mimetype: 'audio/webm', originalname: 'a', buffer: Buffer.from('x') } as Express.Multer.File)).type).toBe('audio');
      expect((await c.uploadAttachment({ mimetype: 'application/pdf', originalname: 'a', buffer: Buffer.from('x') } as Express.Multer.File)).type).toBe('document');
    });
  });
});
