import { BadRequestException } from '@nestjs/common';
import { BibleCourseClassPhotoController } from './bible-course-class-photo.controller';

function svc() {
  return {
    listPhotos: jest.fn().mockResolvedValue([{ id: 'p1' }]),
    addPhoto: jest.fn().mockResolvedValue({ id: 'p1' }),
    removePhoto: jest.fn().mockResolvedValue(undefined),
  };
}
const file = { mimetype: 'image/jpeg', buffer: Buffer.from('x') } as Express.Multer.File;
const user = { userId: 'u1', role: 'SERVANT' };

beforeEach(() => jest.clearAllMocks());

describe('BibleCourseClassPhotoController', () => {
  it('list delega ao service', async () => {
    const s = svc();
    const c = new BibleCourseClassPhotoController(s as never);
    await c.list('class-1');
    expect(s.listPhotos).toHaveBeenCalledWith('class-1');
  });

  it('upload delega passando o userId autenticado', async () => {
    const s = svc();
    const c = new BibleCourseClassPhotoController(s as never);
    await c.upload('class-1', file, user as never);
    expect(s.addPhoto).toHaveBeenCalledWith('class-1', file, 'u1');
  });

  it('upload rejeita arquivo ausente', () => {
    const c = new BibleCourseClassPhotoController(svc() as never);
    expect(() =>
      c.upload('class-1', undefined as never, user as never),
    ).toThrow(BadRequestException);
  });

  it('remove delega ao service', async () => {
    const s = svc();
    const c = new BibleCourseClassPhotoController(s as never);
    await c.remove('class-1', 'p1');
    expect(s.removePhoto).toHaveBeenCalledWith('class-1', 'p1');
  });
});
