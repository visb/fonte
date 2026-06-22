import { BadRequestException } from '@nestjs/common';
import { ActivityAttachmentController } from './activity-attachment.controller';

function svc() {
  return {
    addActivityAttachment: jest.fn().mockResolvedValue({ id: 'at1' }),
    addCommentAttachment: jest.fn().mockResolvedValue({ id: 'at2' }),
    deleteAttachment: jest.fn().mockResolvedValue(undefined),
  };
}
const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') } as Express.Multer.File;
const user = { userId: 'u1', role: 'ADMIN' };

beforeEach(() => jest.clearAllMocks());

describe('ActivityAttachmentController', () => {
  it('upload activity attachment parses a valid duration', async () => {
    const s = svc();
    const c = new ActivityAttachmentController(s as never);
    await c.uploadActivityAttachment('a1', file, { durationSeconds: '12' }, user as never);
    expect(s.addActivityAttachment).toHaveBeenCalledWith('a1', file, user, 12);
  });

  it('duration is null when absent, empty or non-numeric', async () => {
    const s = svc();
    const c = new ActivityAttachmentController(s as never);
    await c.uploadActivityAttachment('a1', file, {}, user as never);
    await c.uploadActivityAttachment('a1', file, { durationSeconds: '' }, user as never);
    await c.uploadActivityAttachment('a1', file, { durationSeconds: 'abc' }, user as never);
    expect(s.addActivityAttachment.mock.calls.map((args) => args[3])).toEqual([null, null, null]);
  });

  it('upload comment attachment delegates with parsed duration', async () => {
    const s = svc();
    const c = new ActivityAttachmentController(s as never);
    await c.uploadCommentAttachment('a1', 'c1', file, { durationSeconds: '5' }, user as never);
    expect(s.addCommentAttachment).toHaveBeenCalledWith('a1', 'c1', file, user, 5);
  });

  it('both upload routes reject a missing file', async () => {
    const c = new ActivityAttachmentController(svc() as never);
    expect(() => c.uploadActivityAttachment('a1', undefined as never, {}, user as never)).toThrow(BadRequestException);
    expect(() => c.uploadCommentAttachment('a1', 'c1', undefined as never, {}, user as never)).toThrow(BadRequestException);
  });

  it('deleteAttachment delegates to the service', async () => {
    const s = svc();
    const c = new ActivityAttachmentController(s as never);
    await c.deleteAttachment('a1', 'at1', user as never);
    expect(s.deleteAttachment).toHaveBeenCalledWith('a1', 'at1', user);
  });
});
