import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BibleCourseClassPhotoService } from './bible-course-class-photo.service';
import { BibleCourseClassPhoto } from './bible-course-class-photo.entity';
import { BibleCourseClass } from './bible-course-class.entity';
import { StorageService } from '../storage/storage.service';

const USER_ID = 'user-1';

function imageFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    originalname: 'turma.jpg',
    mimetype: 'image/jpeg',
    size: 2048,
    buffer: Buffer.from('fake-jpeg'),
    ...overrides,
  } as Express.Multer.File;
}

function makePhotoRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest
      .fn()
      .mockImplementation((v) =>
        Promise.resolve({ id: 'photo-1', createdAt: new Date(), ...v }),
      ),
    softRemove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeClassRepo(klass: Partial<BibleCourseClass> | null = { id: 'class-1' }) {
  return {
    findOne: jest.fn().mockResolvedValue(klass),
  };
}

function makeStorage(overrides: Record<string, jest.Mock> = {}) {
  return {
    decodeOriginalName: jest.fn().mockImplementation((n: string) => n),
    uniqueFilename: jest.fn().mockReturnValue('uniq.jpg'),
    upload: jest.fn().mockResolvedValue('/uploads/bible-course-classes/uniq.jpg'),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeService(
  photoRepo: ReturnType<typeof makePhotoRepo>,
  classRepo: ReturnType<typeof makeClassRepo> = makeClassRepo(),
  storage: ReturnType<typeof makeStorage> = makeStorage(),
) {
  return new BibleCourseClassPhotoService(
    photoRepo as unknown as Repository<BibleCourseClassPhoto>,
    classRepo as unknown as Repository<BibleCourseClass>,
    storage as unknown as StorageService,
  );
}

function photo(
  partial: Partial<BibleCourseClassPhoto> = {},
): BibleCourseClassPhoto {
  return {
    id: 'photo-1',
    classId: 'class-1',
    fileUrl: '/uploads/bible-course-classes/uniq.jpg',
    fileName: 'turma.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 2048,
    createdByUserId: USER_ID,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    deletedAt: null,
    ...partial,
  } as BibleCourseClassPhoto;
}

beforeEach(() => jest.clearAllMocks());

describe('BibleCourseClassPhotoService.addPhoto', () => {
  it('404 quando a turma não existe', async () => {
    const service = makeService(makePhotoRepo(), makeClassRepo(null));
    await expect(
      service.addPhoto('class-1', imageFile(), USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400 quando o arquivo não foi enviado', async () => {
    const service = makeService(makePhotoRepo());
    await expect(
      service.addPhoto('class-1', undefined as never, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita mimetype fora da allowlist (defesa contra upload arbitrário)', async () => {
    const storage = makeStorage();
    const service = makeService(makePhotoRepo(), makeClassRepo(), storage);
    await expect(
      service.addPhoto(
        'class-1',
        imageFile({ mimetype: 'application/pdf', originalname: 'x.pdf' }),
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])(
    'aceita imagem %s: grava no storage e persiste',
    async (mimetype) => {
      const repo = makePhotoRepo();
      const storage = makeStorage();
      const service = makeService(repo, makeClassRepo(), storage);

      const result = await service.addPhoto(
        'class-1',
        imageFile({ mimetype, originalname: 'foto' }),
        USER_ID,
      );

      expect(storage.upload).toHaveBeenCalledWith(
        'bible-course-classes',
        'uniq.jpg',
        expect.any(Buffer),
        mimetype,
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.classId).toBe('class-1');
      expect(result.mimeType).toBe(mimetype);
      expect(result.createdByUserId).toBe(USER_ID);
      expect(typeof result.createdAt).toBe('string');
    },
  );
});

describe('BibleCourseClassPhotoService.listPhotos', () => {
  it('404 quando a turma não existe', async () => {
    const service = makeService(makePhotoRepo(), makeClassRepo(null));
    await expect(service.listPhotos('class-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lista fotos da turma ordenadas por created_at, excluindo soft-deletadas', async () => {
    const repo = makePhotoRepo({
      find: jest.fn().mockResolvedValue([photo({ id: 'p1' }), photo({ id: 'p2' })]),
    });
    const service = makeService(repo);

    const rows = await service.listPhotos('class-1');

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ classId: 'class-1' }),
        order: { createdAt: 'ASC' },
      }),
    );
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2']);
  });
});

describe('BibleCourseClassPhotoService.removePhoto', () => {
  it('404 quando a turma não existe', async () => {
    const service = makeService(makePhotoRepo(), makeClassRepo(null));
    await expect(
      service.removePhoto('class-1', 'photo-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 quando a foto não pertence à turma', async () => {
    const repo = makePhotoRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo);
    await expect(
      service.removePhoto('class-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove: apaga o objeto no bucket e faz soft delete do registro', async () => {
    const repo = makePhotoRepo({
      findOne: jest.fn().mockResolvedValue(photo()),
    });
    const storage = makeStorage();
    const service = makeService(repo, makeClassRepo(), storage);

    await service.removePhoto('class-1', 'photo-1');

    expect(storage.delete).toHaveBeenCalledWith(
      '/uploads/bible-course-classes/uniq.jpg',
    );
    expect(repo.softRemove).toHaveBeenCalled();
  });

  it('delete no bucket é best-effort: falha loga e o soft delete segue', async () => {
    const repo = makePhotoRepo({
      findOne: jest.fn().mockResolvedValue(photo()),
    });
    const storage = makeStorage({
      delete: jest.fn().mockRejectedValue(new Error('bucket down')),
    });
    const service = makeService(repo, makeClassRepo(), storage);

    await expect(
      service.removePhoto('class-1', 'photo-1'),
    ).resolves.toBeUndefined();
    expect(repo.softRemove).toHaveBeenCalled();
  });
});
