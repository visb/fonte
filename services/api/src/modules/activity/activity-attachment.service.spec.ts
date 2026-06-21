import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivityStatus, Role } from '@fonte/types';
import { ActivityAttachmentService } from './activity-attachment.service';
import { ActivityAttachment } from './activity-attachment.entity';
import { ActivityComment } from './activity-comment.entity';
import { Activity } from './activity.entity';
import { ActivityService, ActivityUser } from './activity.service';
import { StorageService } from '../storage/storage.service';

const ADMIN: ActivityUser = { userId: 'admin-user', role: Role.ADMIN };
const CREATOR: ActivityUser = { userId: 'creator-user', role: Role.COORDINATOR };
const OTHER: ActivityUser = { userId: 'other-user', role: Role.SERVANT };

function pdfFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    originalname: 'contrato.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4'),
    ...overrides,
  } as Express.Multer.File;
}

function makeAttachmentRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest
      .fn()
      .mockImplementation((v) =>
        Promise.resolve({ id: 'att-1', createdAt: new Date(), ...v }),
      ),
    softRemove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeCommentRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeStorage(overrides: Record<string, jest.Mock> = {}) {
  return {
    decodeOriginalName: jest.fn().mockImplementation((n: string) => n),
    uniqueFilename: jest.fn().mockReturnValue('uniq.pdf'),
    upload: jest.fn().mockResolvedValue('/uploads/activities/uniq.pdf'),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function activity(partial: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    status: ActivityStatus.DRAFT,
    createdByUserId: 'creator-user',
    houseId: 'house-1',
    ...partial,
  } as Activity;
}

function makeActivityService(act: Activity = activity()) {
  return {
    loadVisibleOrFail: jest.fn().mockResolvedValue(act),
  } as unknown as ActivityService;
}

function makeService(
  attachmentRepo: ReturnType<typeof makeAttachmentRepo>,
  commentRepo: ReturnType<typeof makeCommentRepo> = makeCommentRepo(),
  activityService: ActivityService = makeActivityService(),
  storage: ReturnType<typeof makeStorage> = makeStorage(),
) {
  return new ActivityAttachmentService(
    attachmentRepo as unknown as Repository<ActivityAttachment>,
    commentRepo as unknown as Repository<ActivityComment>,
    activityService,
    storage as unknown as StorageService,
  );
}

function attachment(
  partial: Partial<ActivityAttachment> = {},
): ActivityAttachment {
  return {
    id: 'att-1',
    activityId: 'act-1',
    commentId: null,
    fileUrl: '/uploads/activities/uniq.pdf',
    fileName: 'contrato.pdf',
    fileType: 'document',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    createdByUserId: 'creator-user',
    createdAt: new Date(),
    deletedAt: null,
    ...partial,
  } as ActivityAttachment;
}

describe('ActivityAttachmentService.addActivityAttachment (allowlist + storage)', () => {
  it('barra quando a atividade está fora de escopo (404)', async () => {
    const activityService = {
      loadVisibleOrFail: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Activity not found')),
    } as unknown as ActivityService;
    const service = makeService(
      makeAttachmentRepo(),
      makeCommentRepo(),
      activityService,
    );

    await expect(
      service.addActivityAttachment('act-1', pdfFile(), CREATOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita mimetype fora da allowlist (defesa contra upload arbitrário)', async () => {
    const storage = makeStorage();
    const service = makeService(
      makeAttachmentRepo(),
      makeCommentRepo(),
      makeActivityService(),
      storage,
    );

    await expect(
      service.addActivityAttachment(
        'act-1',
        pdfFile({ mimetype: 'application/x-msdownload', originalname: 'a.exe' }),
        CREATOR,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('aceita imagem: grava no storage e persiste como type=image', async () => {
    const repo = makeAttachmentRepo();
    const storage = makeStorage({
      upload: jest.fn().mockResolvedValue('/uploads/activities/img.png'),
    });
    const service = makeService(
      repo,
      makeCommentRepo(),
      makeActivityService(),
      storage,
    );

    const result = await service.addActivityAttachment(
      'act-1',
      pdfFile({ mimetype: 'image/png', originalname: 'foto.png', size: 50 }),
      CREATOR,
    );

    expect(storage.upload).toHaveBeenCalledWith(
      'activities',
      'uniq.pdf',
      expect.any(Buffer),
      'image/png',
    );
    expect(result.fileType).toBe('image');
    expect(result.commentId).toBeNull();
    expect(result.createdByUserId).toBe('creator-user');
  });

  it('aceita pdf como type=document', async () => {
    const service = makeService(makeAttachmentRepo());
    const result = await service.addActivityAttachment('act-1', pdfFile(), CREATOR);
    expect(result.fileType).toBe('document');
  });

  // ── áudio (story 74) ──────────────────────────────────────────────────────

  it.each([
    'audio/webm',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
  ])('aceita áudio %s e deriva type=audio', async (mimetype) => {
    const service = makeService(makeAttachmentRepo());
    const result = await service.addActivityAttachment(
      'act-1',
      pdfFile({ mimetype, originalname: 'nota.m4a' }),
      CREATOR,
    );
    expect(result.fileType).toBe('audio');
  });

  it('persiste a duração (arredondada) para áudio', async () => {
    const service = makeService(makeAttachmentRepo());
    const result = await service.addActivityAttachment(
      'act-1',
      pdfFile({ mimetype: 'audio/webm', originalname: 'gravacao.webm' }),
      CREATOR,
      42.6,
    );
    expect(result.durationSeconds).toBe(43);
  });

  it('ignora duração de não-áudio (fica null)', async () => {
    const service = makeService(makeAttachmentRepo());
    const result = await service.addActivityAttachment(
      'act-1',
      pdfFile(),
      CREATOR,
      90,
    );
    expect(result.durationSeconds).toBeNull();
  });

  it('descarta duração inválida (<= 0 ou NaN) mesmo para áudio', async () => {
    const service = makeService(makeAttachmentRepo());
    const zero = await service.addActivityAttachment(
      'act-1',
      pdfFile({ mimetype: 'audio/webm', originalname: 'a.webm' }),
      CREATOR,
      0,
    );
    expect(zero.durationSeconds).toBeNull();
    const nan = await service.addActivityAttachment(
      'act-1',
      pdfFile({ mimetype: 'audio/webm', originalname: 'a.webm' }),
      CREATOR,
      Number.NaN,
    );
    expect(nan.durationSeconds).toBeNull();
  });
});

describe('ActivityAttachmentService.addCommentAttachment', () => {
  it('404 quando o comentário não pertence à atividade', async () => {
    const commentRepo = makeCommentRepo({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const service = makeService(makeAttachmentRepo(), commentRepo);

    await expect(
      service.addCommentAttachment('act-1', 'c-1', pdfFile(), CREATOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persiste o anexo vinculado ao comentário', async () => {
    const commentRepo = makeCommentRepo({
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'c-1', activityId: 'act-1', createdByUserId: 'other-user' }),
    });
    const repo = makeAttachmentRepo();
    const service = makeService(repo, commentRepo);

    const result = await service.addCommentAttachment(
      'act-1',
      'c-1',
      pdfFile(),
      CREATOR,
    );

    expect(result.commentId).toBe('c-1');
  });
});

describe('ActivityAttachmentService.deleteAttachment (permissão + storage.delete)', () => {
  it('404 quando o anexo não existe na atividade', async () => {
    const repo = makeAttachmentRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    await expect(
      service.deleteAttachment('act-1', 'missing', CREATOR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('anexo de atividade: criador exclui enquanto DRAFT (remove do storage + soft delete)', async () => {
    const repo = makeAttachmentRepo({
      findOne: jest.fn().mockResolvedValue(attachment()),
    });
    const storage = makeStorage();
    const service = makeService(
      repo,
      makeCommentRepo(),
      makeActivityService(activity({ status: ActivityStatus.DRAFT })),
      storage,
    );

    await service.deleteAttachment('act-1', 'att-1', CREATOR);

    expect(storage.delete).toHaveBeenCalledWith('/uploads/activities/uniq.pdf');
    expect(repo.softRemove).toHaveBeenCalled();
  });

  it('anexo de atividade: criador NÃO exclui quando já não é DRAFT → 403', async () => {
    const repo = makeAttachmentRepo({
      findOne: jest.fn().mockResolvedValue(attachment()),
    });
    const storage = makeStorage();
    const service = makeService(
      repo,
      makeCommentRepo(),
      makeActivityService(activity({ status: ActivityStatus.TODO })),
      storage,
    );

    await expect(
      service.deleteAttachment('act-1', 'att-1', CREATOR),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.softRemove).not.toHaveBeenCalled();
  });

  it('anexo de atividade: terceiro não exclui → 403', async () => {
    const repo = makeAttachmentRepo({
      findOne: jest.fn().mockResolvedValue(attachment()),
    });
    const service = makeService(repo);

    await expect(
      service.deleteAttachment('act-1', 'att-1', OTHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('anexo de atividade: ADMIN sempre exclui (mesmo fora de DRAFT)', async () => {
    const repo = makeAttachmentRepo({
      findOne: jest.fn().mockResolvedValue(attachment()),
    });
    const service = makeService(
      repo,
      makeCommentRepo(),
      makeActivityService(activity({ status: ActivityStatus.DONE })),
    );

    await service.deleteAttachment('act-1', 'att-1', ADMIN);
    expect(repo.softRemove).toHaveBeenCalled();
  });

  it('anexo de comentário: autor do comentário exclui', async () => {
    const repo = makeAttachmentRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(attachment({ commentId: 'c-1', createdByUserId: 'other-user' })),
    });
    const commentRepo = makeCommentRepo({
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'c-1', createdByUserId: 'creator-user' }),
    });
    const service = makeService(repo, commentRepo);

    await service.deleteAttachment('act-1', 'att-1', CREATOR);
    expect(repo.softRemove).toHaveBeenCalled();
  });

  it('anexo de comentário: terceiro (não autor do comentário) não exclui → 403', async () => {
    const repo = makeAttachmentRepo({
      findOne: jest.fn().mockResolvedValue(attachment({ commentId: 'c-1' })),
    });
    const commentRepo = makeCommentRepo({
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'c-1', createdByUserId: 'creator-user' }),
    });
    const service = makeService(repo, commentRepo);

    await expect(
      service.deleteAttachment('act-1', 'att-1', OTHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ActivityAttachmentService.listActivityAttachments / attachmentsByComment (canDelete na view)', () => {
  it('listActivityAttachments marca canDelete=true para o criador em DRAFT', async () => {
    const repo = makeAttachmentRepo({
      find: jest.fn().mockResolvedValue([attachment()]),
    });
    const service = makeService(repo);

    const rows = await service.listActivityAttachments(
      activity({ status: ActivityStatus.DRAFT }),
      CREATOR,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].canDelete).toBe(true);
  });

  it('listActivityAttachments marca canDelete=false para terceiro', async () => {
    const repo = makeAttachmentRepo({
      find: jest.fn().mockResolvedValue([attachment()]),
    });
    const service = makeService(repo);

    const rows = await service.listActivityAttachments(activity(), OTHER);
    expect(rows[0].canDelete).toBe(false);
  });

  it('attachmentsByComment agrupa por commentId e resolve canDelete pelo autor do comentário', async () => {
    const rows = [
      attachment({ id: 'a1', commentId: 'c-1', createdByUserId: 'x' }),
      attachment({ id: 'a2', commentId: 'c-1', createdByUserId: 'x' }),
    ];
    const repo = makeAttachmentRepo({
      find: jest.fn().mockResolvedValue(rows),
    });
    const service = makeService(repo);

    const map = await service.attachmentsByComment(
      'act-1',
      [{ id: 'c-1', createdByUserId: 'creator-user' } as ActivityComment],
      CREATOR,
    );

    expect(map.get('c-1')).toHaveLength(2);
    expect(map.get('c-1')![0].canDelete).toBe(true);
  });
});
