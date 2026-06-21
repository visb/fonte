import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Role } from '@fonte/types';
import { ActivityCommentService } from './activity-comment.service';
import { ActivityComment } from './activity-comment.entity';
import { ActivityService, ActivityUser } from './activity.service';
import { ActivityAttachmentService } from './activity-attachment.service';

const ADMIN: ActivityUser = { userId: 'admin-user', role: Role.ADMIN };
const COORD: ActivityUser = { userId: 'coord-user', role: Role.COORDINATOR };
const OTHER: ActivityUser = { userId: 'other-user', role: Role.SERVANT };

function makeCommentRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest
      .fn()
      .mockImplementation((v) =>
        Promise.resolve({ id: 'comment-1', createdAt: new Date(), ...v }),
      ),
    softRemove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Stub do ActivityService: controla visibilidade e resolução de autores. */
function makeActivityService(
  overrides: Partial<Record<keyof ActivityService, jest.Mock>> = {},
) {
  return {
    loadVisibleOrFail: jest.fn().mockResolvedValue({ id: 'act-1' }),
    resolveStaffRefs: jest.fn().mockResolvedValue(new Map()),
    recordCommentEvent: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ActivityService;
}

/** Stub do ActivityAttachmentService: por padrão sem anexos. */
function makeAttachmentService(
  overrides: Partial<Record<keyof ActivityAttachmentService, jest.Mock>> = {},
) {
  return {
    attachmentsByComment: jest.fn().mockResolvedValue(new Map()),
    ...overrides,
  } as unknown as ActivityAttachmentService;
}

function makeService(
  commentRepo: ReturnType<typeof makeCommentRepo>,
  activityService: ActivityService = makeActivityService(),
  attachmentService: ActivityAttachmentService = makeAttachmentService(),
) {
  return new ActivityCommentService(
    commentRepo as unknown as Repository<ActivityComment>,
    activityService,
    attachmentService,
  );
}

function comment(partial: Partial<ActivityComment> = {}): ActivityComment {
  return {
    id: 'comment-1',
    activityId: 'act-1',
    body: 'olá',
    createdByUserId: 'coord-user',
    createdAt: new Date(),
    deletedAt: null,
    ...partial,
  } as ActivityComment;
}

describe('ActivityCommentService.findAll (visibility)', () => {
  it('barra a leitura quando a atividade está fora de escopo (404)', async () => {
    const activityService = makeActivityService({
      loadVisibleOrFail: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Activity not found')),
    });
    const service = makeService(makeCommentRepo(), activityService);

    await expect(service.findAll('act-1', COORD)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lista em ordem cronológica e resolve o autor pelo nome', async () => {
    const repo = makeCommentRepo({
      find: jest.fn().mockResolvedValue([comment()]),
    });
    const activityService = makeActivityService({
      resolveStaffRefs: jest
        .fn()
        .mockResolvedValue(
          new Map([
            ['coord-user', { id: 'staff-1', name: 'Maria', userId: 'coord-user' }],
          ]),
        ),
    });
    const service = makeService(repo, activityService);

    const result = await service.findAll('act-1', COORD);

    expect(repo.find).toHaveBeenCalledWith({
      where: { activityId: 'act-1' },
      order: { createdAt: 'ASC' },
    });
    expect(result[0].author).toEqual({
      id: 'staff-1',
      name: 'Maria',
      userId: 'coord-user',
    });
  });
});

describe('ActivityCommentService.create', () => {
  it('barra a criação quando a atividade está fora de escopo (404)', async () => {
    const activityService = makeActivityService({
      loadVisibleOrFail: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Activity not found')),
    });
    const service = makeService(makeCommentRepo(), activityService);

    await expect(
      service.create('act-1', { body: 'oi' }, COORD),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persiste com o autor = usuário autenticado', async () => {
    const created: Partial<ActivityComment>[] = [];
    const repo = makeCommentRepo({
      create: jest.fn().mockImplementation((v) => {
        created.push(v);
        return v;
      }),
    });
    const service = makeService(repo);

    const result = await service.create('act-1', { body: 'novo comentário' }, COORD);

    expect(created[0].createdByUserId).toBe('coord-user');
    expect(created[0].activityId).toBe('act-1');
    expect(created[0].body).toBe('novo comentário');
    expect(result.body).toBe('novo comentário');
  });

  it('aceita comentário só de áudio: body ausente vira string vazia (story 74)', async () => {
    const created: Partial<ActivityComment>[] = [];
    const repo = makeCommentRepo({
      create: jest.fn().mockImplementation((v) => {
        created.push(v);
        return v;
      }),
    });
    const service = makeService(repo);

    const result = await service.create('act-1', {}, COORD);

    expect(created[0].body).toBe('');
    expect(result.body).toBe('');
  });

  it('registra o evento COMMENTED na trilha (story 66)', async () => {
    const activityService = makeActivityService();
    const repo = makeCommentRepo({
      save: jest
        .fn()
        .mockResolvedValue({ id: 'comment-99', createdAt: new Date(), activityId: 'act-1', body: 'x', createdByUserId: 'coord-user' }),
    });
    const service = makeService(repo, activityService);

    await service.create('act-1', { body: 'x' }, COORD);

    expect(activityService.recordCommentEvent).toHaveBeenCalledWith(
      'act-1',
      'comment-99',
      COORD,
    );
  });
});

describe('ActivityCommentService.remove (assertCanDelete)', () => {
  it('404 quando o comentário não existe na atividade', async () => {
    const repo = makeCommentRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    await expect(
      service.remove('act-1', 'missing', COORD),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('o autor pode excluir o próprio comentário', async () => {
    const repo = makeCommentRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(comment({ createdByUserId: 'coord-user' })),
    });
    const service = makeService(repo);

    await service.remove('act-1', 'comment-1', COORD);
    expect(repo.softRemove).toHaveBeenCalled();
  });

  it('um terceiro (não autor, não admin) não pode excluir → 403', async () => {
    const repo = makeCommentRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(comment({ createdByUserId: 'coord-user' })),
    });
    const service = makeService(repo);

    await expect(
      service.remove('act-1', 'comment-1', OTHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.softRemove).not.toHaveBeenCalled();
  });

  it('ADMIN pode excluir o comentário de outra pessoa', async () => {
    const repo = makeCommentRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(comment({ createdByUserId: 'coord-user' })),
    });
    const service = makeService(repo);

    await service.remove('act-1', 'comment-1', ADMIN);
    expect(repo.softRemove).toHaveBeenCalled();
  });
});
