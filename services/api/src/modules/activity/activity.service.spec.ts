import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivityStatus, Role } from '@fonte/types';
import { ActivityEventType } from '@fonte/types';
import { ActivityService, ActivityUser } from './activity.service';
import { Activity } from './activity.entity';
import { Staff } from '../staff/staff.entity';
import { ActivityEventService } from './activity-event.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateActivityDto } from './dto/create-activity.dto';

const ADMIN: ActivityUser = { userId: 'admin-user', role: Role.ADMIN };
const COORD: ActivityUser = { userId: 'coord-user', role: Role.COORDINATOR };
const COORD2: ActivityUser = { userId: 'coord2-user', role: Role.SERVANT };

function makeQb(items: Activity[] = []) {
  const qb: Record<string, jest.Mock> = {};
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue(items);
  return qb;
}

function makeActivityRepo(overrides: Record<string, jest.Mock> = {}, qbItems: Activity[] = []) {
  return {
    createQueryBuilder: jest.fn().mockReturnValue(makeQb(qbItems)),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'act-1', ...v })),
    softRemove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** staffByUser maps userId→houseId; staffById maps staffId→Staff. */
function makeStaffRepo(
  staffByUser: Record<string, { houseId: string | null }> = {},
  staffById: Record<string, Partial<Staff>> = {},
) {
  return {
    findOne: jest.fn().mockImplementation(({ where }: { where: { userId?: string; id?: string } }) => {
      if (where.userId !== undefined) {
        const s = staffByUser[where.userId];
        return Promise.resolve(s ? { id: `staff-${where.userId}`, ...s } : null);
      }
      if (where.id !== undefined) {
        return Promise.resolve(staffById[where.id] ?? null);
      }
      return Promise.resolve(null);
    }),
    // Batch lookup usado por resolveCreators (createdBy). Resolve cada userId
    // contra staffByUser, devolvendo um Staff sintético com nome.
    find: jest.fn().mockImplementation(({ where }: { where: Array<{ userId?: string }> }) => {
      const conditions = Array.isArray(where) ? where : [where];
      const result = conditions
        .map((c) => c.userId)
        .filter((uid): uid is string => uid !== undefined && staffByUser[uid] !== undefined)
        .map((uid) => ({
          id: `staff-${uid}`,
          name: `Staff ${uid}`,
          userId: uid,
          ...staffByUser[uid],
        }));
      return Promise.resolve(result);
    }),
  };
}

/** Mock do ActivityEventService — registra chamadas a `record` para asserção. */
function makeEvents() {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    actorUserIds: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
  };
}

/** Mock do ActivityAttachmentService — detalhe sem anexos por padrão. */
function makeAttachments() {
  return {
    listActivityAttachments: jest.fn().mockResolvedValue([]),
  };
}

function makeService(
  activityRepo: ReturnType<typeof makeActivityRepo>,
  staffRepo: ReturnType<typeof makeStaffRepo> = makeStaffRepo(),
  events: ReturnType<typeof makeEvents> = makeEvents(),
  attachments: ReturnType<typeof makeAttachments> = makeAttachments(),
) {
  const service = new ActivityService(
    activityRepo as unknown as Repository<Activity>,
    staffRepo as unknown as Repository<Staff>,
    events as unknown as ActivityEventService,
    attachments as unknown as import('./activity-attachment.service').ActivityAttachmentService,
  );
  return service;
}

function activity(partial: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    title: 'Trocar lâmpada',
    description: null,
    status: ActivityStatus.DRAFT,
    houseId: 'house-1',
    house: null,
    responsibleStaffId: null,
    responsible: null,
    createdByUserId: 'coord-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...partial,
  } as Activity;
}

describe('ActivityService.findAll (scoping)', () => {
  it('coordinator only sees own house (forces house_id, excludes houseless)', async () => {
    const qb = makeQb([]);
    const repo = makeActivityRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await service.findAll(COORD, {});

    const houseFilter = qb.andWhere.mock.calls.find(
      (c) => c[0] === 'a.house_id = :houseId',
    );
    expect(houseFilter).toBeDefined();
    expect(houseFilter![1]).toEqual({ houseId: 'house-1' });
  });

  it('coordinator with no house sees nothing', async () => {
    const repo = makeActivityRepo();
    const staff = makeStaffRepo({}); // no staff for coord-user
    const service = makeService(repo, staff);

    await expect(service.findAll(COORD, {})).resolves.toEqual([]);
  });

  it('admin is not forced to a house', async () => {
    const qb = makeQb([]);
    const repo = makeActivityRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    await service.findAll(ADMIN, {});

    const houseFilter = qb.andWhere.mock.calls.find(
      (c) => c[0] === 'a.house_id = :houseId',
    );
    expect(houseFilter).toBeUndefined();
  });
});

describe('ActivityService view shape (story 71 — description fora da lista)', () => {
  it('findAll omits description from each list item', async () => {
    const qb = makeQb([
      activity({ id: 'a-1', description: 'texto que a lista não usa' }),
    ]);
    const repo = makeActivityRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    const result = await service.findAll(COORD, {});

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('description');
    // Demais campos do item de lista seguem presentes.
    expect(result[0]).toMatchObject({ id: 'a-1', title: 'Trocar lâmpada' });
  });

  it('findOne includes description in the detail view', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(
        activity({ houseId: 'house-1', description: 'detalhe completo' }),
      ),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    const result = await service.findOne('act-1', COORD);

    expect(result).toHaveProperty('description', 'detalhe completo');
  });

  it('findOne includes description even when null', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(
        activity({ houseId: 'house-1', description: null }),
      ),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    const result = await service.findOne('act-1', COORD);

    expect(result).toHaveProperty('description', null);
  });
});

describe('ActivityService.findOne (visibility)', () => {
  it('coordinator cannot see another house (404)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ houseId: 'house-OTHER' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(service.findOne('act-1', COORD)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('coordinator cannot see houseless activity (404)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ houseId: null })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(service.findOne('act-1', COORD)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admin sees houseless activity', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ houseId: null })),
    });
    const service = makeService(repo);

    await expect(service.findOne('act-1', ADMIN)).resolves.toMatchObject({ id: 'act-1' });
  });
});

describe('ActivityService.create', () => {
  it('coordenador sem casa na atividade não cria em TODO (403)', async () => {
    const repo = makeActivityRepo();
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.create({ title: 'x', status: ActivityStatus.TODO } as never, COORD),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ops creating without status persists DRAFT and no responsible', async () => {
    const created: Partial<Activity>[] = [];
    const repo = makeActivityRepo({
      create: jest.fn().mockImplementation((v) => {
        created.push(v);
        return v;
      }),
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.DRAFT })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await service.create({ title: 'x', houseId: 'house-1' } as never, COORD);

    expect(created[0].status).toBe(ActivityStatus.DRAFT);
    expect(created[0].responsibleStaffId).toBeNull();
  });

  it('admin creating in TODO requires a responsible', async () => {
    const repo = makeActivityRepo();
    const service = makeService(repo);

    await expect(
      service.create({ title: 'x', status: ActivityStatus.TODO } as never, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('admin creates in TODO with a valid responsible', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.TODO })),
    });
    const staff = makeStaffRepo({}, { 'staff-9': { id: 'staff-9', userId: 'u9' } as Staff });
    const service = makeService(repo, staff);

    await expect(
      service.create(
        { title: 'x', status: ActivityStatus.TODO, responsibleStaffId: 'staff-9' } as never,
        ADMIN,
      ),
    ).resolves.toBeDefined();
  });
});

describe('ActivityService.changeStatus (transitions)', () => {
  it('DRAFT → REQUESTED only by creator or ADMIN', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(activity({ status: ActivityStatus.DRAFT, createdByUserId: 'coord-user' })),
    });
    const staff = makeStaffRepo({ 'coord2-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    // a different staff of the same house cannot submit it
    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.REQUESTED }, COORD2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('DRAFT → REQUESTED allowed for the creator', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(activity({ status: ActivityStatus.DRAFT, createdByUserId: 'coord-user' }))
        .mockResolvedValue(activity({ status: ActivityStatus.REQUESTED })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.REQUESTED }, COORD),
    ).resolves.toBeDefined();
  });

  it('REQUESTED → TODO is forbidden for a SERVANT (story 220: house coordinator or ADMIN)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.REQUESTED })),
    });
    const staff = makeStaffRepo({ 'coord2-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.TODO, responsibleStaffId: 'staff-9' }, COORD2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('REQUESTED → TODO by ADMIN requires a responsible', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.REQUESTED, responsibleStaffId: null })),
    });
    const service = makeService(repo);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.TODO }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('REQUESTED → DRAFT allowed for the creator (return to draft)', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ status: ActivityStatus.REQUESTED, createdByUserId: 'coord-user' }),
        )
        .mockResolvedValue(activity({ status: ActivityStatus.DRAFT })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DRAFT }, COORD),
    ).resolves.toBeDefined();
  });

  it('REQUESTED → DRAFT allowed for ADMIN even if not the creator', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ status: ActivityStatus.REQUESTED, createdByUserId: 'coord-user' }),
        )
        .mockResolvedValue(activity({ status: ActivityStatus.DRAFT })),
    });
    const service = makeService(repo);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DRAFT }, ADMIN),
    ).resolves.toBeDefined();
  });

  it('REQUESTED → DRAFT forbidden for a staff who is neither creator nor ADMIN', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(
          activity({ status: ActivityStatus.REQUESTED, createdByUserId: 'coord-user' }),
        ),
    });
    const staff = makeStaffRepo({ 'coord2-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DRAFT }, COORD2),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('REQUESTED → DRAFT keeps scope: coord of another house gets 404', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(
        activity({
          status: ActivityStatus.REQUESTED,
          houseId: 'house-OTHER',
          createdByUserId: 'coord-user',
        }),
      ),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DRAFT }, COORD),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('REQUESTED → DRAFT preserves a pre-set responsibleStaffId', async () => {
    const saved: Activity[] = [];
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({
            status: ActivityStatus.REQUESTED,
            createdByUserId: 'coord-user',
            responsibleStaffId: 'staff-9',
          }),
        )
        .mockResolvedValue(activity({ status: ActivityStatus.DRAFT })),
      save: jest.fn(async (a: Activity) => {
        saved.push(a);
        return a;
      }),
    });
    const service = makeService(repo);

    await service.changeStatus('act-1', { status: ActivityStatus.DRAFT }, ADMIN);

    expect(saved[0].status).toBe(ActivityStatus.DRAFT);
    expect(saved[0].responsibleStaffId).toBe('staff-9');
  });

  it('rejects an invalid transition from REQUESTED (REQUESTED → DOING)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.REQUESTED })),
    });
    const service = makeService(repo);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DOING }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('work transition (TODO → DOING) only by responsible or ADMIN', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(activity({ status: ActivityStatus.TODO, responsibleStaffId: 'staff-owner' })),
    });
    const staff = makeStaffRepo(
      { 'coord-user': { houseId: 'house-1' } },
      { 'staff-owner': { id: 'staff-owner', userId: 'someone-else' } as Staff },
    );
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DOING }, COORD),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('work transition allowed for the responsible staff', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(activity({ status: ActivityStatus.TODO, responsibleStaffId: 'staff-owner' }))
        .mockResolvedValue(activity({ status: ActivityStatus.DOING })),
    });
    const staff = makeStaffRepo(
      { 'coord-user': { houseId: 'house-1' } },
      { 'staff-owner': { id: 'staff-owner', userId: 'coord-user' } as Staff },
    );
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DOING }, COORD),
    ).resolves.toBeDefined();
  });

  it('rejects an invalid transition (DRAFT → DONE)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.DRAFT })),
    });
    const service = makeService(repo);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.DONE }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ActivityService description sanitization (story 72)', () => {
  it('create sanitizes the markdown description (strips raw HTML)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ description: null })),
    });
    const service = makeService(repo);

    await service.create(
      { title: 'T', description: 'Oi <script>alert(1)</script>' },
      ADMIN,
    );

    const saved = (repo.create as jest.Mock).mock.calls[0][0];
    expect(saved.description).not.toContain('<script');
    expect(saved.description).toContain('Oi');
  });

  it('update sanitizes the markdown description (neutralizes javascript: link)', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ status: ActivityStatus.DRAFT, createdByUserId: 'coord-user' }),
        )
        .mockResolvedValue(activity({ description: '[x](#)' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const saveSpy = jest.fn().mockImplementation((v) => Promise.resolve(v));
    repo.save = saveSpy;
    const service = makeService(repo, staff);

    await service.update('act-1', { description: '[x](javascript:alert(1))' }, COORD);

    const savedEntity = saveSpy.mock.calls[0][0];
    expect(savedEntity.description).not.toContain('javascript:');
    expect(savedEntity.description).toBe('[x](#)');
  });

  it('create preserves legitimate markdown (bold, list, http link)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ description: null })),
    });
    const service = makeService(repo);
    const md = '**bold**\n- item\n[site](https://ok.com)';

    await service.create({ title: 'T', description: md }, ADMIN);

    const saved = (repo.create as jest.Mock).mock.calls[0][0];
    expect(saved.description).toBe(md);
  });
});

describe('ActivityService.update (description editing window — story 62)', () => {
  it('creator can edit the description while TODO', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ status: ActivityStatus.TODO, createdByUserId: 'coord-user' }),
        )
        .mockResolvedValue(
          activity({ status: ActivityStatus.TODO, description: 'nova' }),
        ),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.update('act-1', { description: 'nova' }, COORD),
    ).resolves.toBeDefined();
  });

  it('creator cannot edit the description once DOING → 403', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValue(
          activity({ status: ActivityStatus.DOING, createdByUserId: 'coord-user' }),
        ),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.update('act-1', { description: 'tarde demais' }, COORD),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin can edit the description even when DOING', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ status: ActivityStatus.DOING, createdByUserId: 'coord-user' }),
        )
        .mockResolvedValue(
          activity({ status: ActivityStatus.DOING, description: 'override' }),
        ),
    });
    const service = makeService(repo);

    await expect(
      service.update('act-1', { description: 'override' }, ADMIN),
    ).resolves.toBeDefined();
  });
});

describe('ActivityService.remove (soft delete)', () => {
  it('soft-removes when ADMIN', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.TODO })),
    });
    const service = makeService(repo);

    await service.remove('act-1', ADMIN);
    expect(repo.softRemove).toHaveBeenCalled();
  });

  it('creator can only delete own DRAFT', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.REQUESTED, createdByUserId: 'coord-user' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(service.remove('act-1', COORD)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ActivityService — registro de eventos (story 66)', () => {
  it('create registra CREATED', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.DRAFT })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const events = makeEvents();
    const service = makeService(repo, staff, events);

    await service.create({ title: 'x', houseId: 'house-1' } as never, COORD);

    expect(events.record).toHaveBeenCalledWith('act-1', ActivityEventType.CREATED, COORD);
  });

  it('changeStatus registra STATUS_CHANGED com { from, to }', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ status: ActivityStatus.DRAFT, createdByUserId: 'coord-user' }),
        )
        .mockResolvedValue(activity({ status: ActivityStatus.REQUESTED })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const events = makeEvents();
    const service = makeService(repo, staff, events);

    await service.changeStatus('act-1', { status: ActivityStatus.REQUESTED }, COORD);

    expect(events.record).toHaveBeenCalledWith(
      'act-1',
      ActivityEventType.STATUS_CHANGED,
      COORD,
      { from: ActivityStatus.DRAFT, to: ActivityStatus.REQUESTED },
    );
  });

  it('update de título registra TITLE_CHANGED com { from, to }', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ title: 'antigo', createdByUserId: 'coord-user', status: ActivityStatus.DRAFT }),
        )
        .mockResolvedValue(activity({ title: 'novo' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const events = makeEvents();
    const service = makeService(repo, staff, events);

    await service.update('act-1', { title: 'novo' }, COORD);

    expect(events.record).toHaveBeenCalledWith(
      'act-1',
      ActivityEventType.TITLE_CHANGED,
      COORD,
      { from: 'antigo', to: 'novo' },
    );
  });

  it('update de descrição registra DESCRIPTION_CHANGED com { before, after }', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ description: null, createdByUserId: 'coord-user', status: ActivityStatus.TODO }),
        )
        .mockResolvedValue(activity({ description: 'detalhe' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const events = makeEvents();
    const service = makeService(repo, staff, events);

    await service.update('act-1', { description: 'detalhe' }, COORD);

    expect(events.record).toHaveBeenCalledWith(
      'act-1',
      ActivityEventType.DESCRIPTION_CHANGED,
      COORD,
      { before: null, after: 'detalhe' },
    );
  });

  it('update de responsável (ADMIN) registra RESPONSIBLE_CHANGED com { from, to }', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ responsibleStaffId: null, status: ActivityStatus.TODO }),
        )
        .mockResolvedValue(activity({ responsibleStaffId: 'staff-9' })),
    });
    const staff = makeStaffRepo({}, { 'staff-9': { id: 'staff-9', userId: 'u9' } as Staff });
    const events = makeEvents();
    const service = makeService(repo, staff, events);

    await service.update('act-1', { responsibleStaffId: 'staff-9' }, ADMIN);

    expect(events.record).toHaveBeenCalledWith(
      'act-1',
      ActivityEventType.RESPONSIBLE_CHANGED,
      ADMIN,
      { from: null, to: 'staff-9' },
    );
  });

  it('update sem mudança efetiva não registra evento', async () => {
    const repo = makeActivityRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          activity({ title: 'mesmo', createdByUserId: 'coord-user', status: ActivityStatus.DRAFT }),
        )
        .mockResolvedValue(activity({ title: 'mesmo' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const events = makeEvents();
    const service = makeService(repo, staff, events);

    await service.update('act-1', { title: 'mesmo' }, COORD);

    expect(events.record).not.toHaveBeenCalled();
  });

  it('remove registra DELETED', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.TODO })),
    });
    const events = makeEvents();
    const service = makeService(repo, makeStaffRepo(), events);

    await service.remove('act-1', ADMIN);

    expect(events.record).toHaveBeenCalledWith('act-1', ActivityEventType.DELETED, ADMIN);
  });

  it('recordCommentEvent registra COMMENTED com { commentId }', async () => {
    const repo = makeActivityRepo();
    const events = makeEvents();
    const service = makeService(repo, makeStaffRepo(), events);

    await service.recordCommentEvent('act-1', 'comment-9', COORD);

    expect(events.record).toHaveBeenCalledWith(
      'act-1',
      ActivityEventType.COMMENTED,
      COORD,
      { commentId: 'comment-9' },
    );
  });

  it('listEvents valida visibilidade e delega resolvendo atores', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ houseId: 'house-1' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const events = makeEvents();
    events.actorUserIds = jest.fn().mockResolvedValue(['coord-user']);
    events.findAll = jest.fn().mockResolvedValue([{ id: 'evt-1' }]);
    const service = makeService(repo, staff, events);

    const result = await service.listEvents('act-1', COORD);

    expect(events.actorUserIds).toHaveBeenCalledWith('act-1');
    expect(events.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'evt-1' }]);
  });

  it('listEvents barra atividade fora de escopo (404)', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ houseId: 'house-OTHER' })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(service.listEvents('act-1', COORD)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// ── Story 220: coordenador da casa aprova e atribui/troca responsável ─────────

const SERVANT: ActivityUser = { userId: 'servant-user', role: Role.SERVANT };

/** Staff lotados: coord/servant na house-1; staff-in (house-1), staff-out (house-2). */
function story220Staff() {
  return makeStaffRepo(
    {
      'coord-user': { houseId: 'house-1' },
      'servant-user': { houseId: 'house-1' },
    },
    {
      'staff-in': { id: 'staff-in', userId: 'u-in', houseId: 'house-1' } as Staff,
      'staff-in-2': { id: 'staff-in-2', userId: 'u-in-2', houseId: 'house-1' } as Staff,
      'staff-out': { id: 'staff-out', userId: 'u-out', houseId: 'house-2' } as Staff,
    },
  );
}

/** Repo que devolve `first` no load e `after` no findOne do retorno; registra o save. */
function story220Repo(first: Activity, after: Partial<Activity> = {}) {
  const saved: Activity[] = [];
  const repo = makeActivityRepo({
    findOne: jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(activity({ ...first, ...after })),
    save: jest.fn(async (a: Activity) => {
      saved.push({ ...a });
      return a;
    }),
  });
  return { repo, saved };
}

describe('ActivityService.changeStatus — aprovar (story 220)', () => {
  it('COORDINATOR da casa aprova com responsável da casa → TODO + responsável', async () => {
    const { repo, saved } = story220Repo(activity({ status: ActivityStatus.REQUESTED }));
    const service = makeService(repo, story220Staff());

    await service.changeStatus(
      'act-1',
      { status: ActivityStatus.TODO, responsibleStaffId: 'staff-in' },
      COORD,
    );

    expect(saved[0].status).toBe(ActivityStatus.TODO);
    expect(saved[0].responsibleStaffId).toBe('staff-in');
  });

  it('COORDINATOR aprova atividade que já tem responsável, sem body', async () => {
    const { repo, saved } = story220Repo(
      activity({ status: ActivityStatus.REQUESTED, responsibleStaffId: 'staff-in' }),
    );
    const service = makeService(repo, story220Staff());

    await service.changeStatus('act-1', { status: ActivityStatus.TODO }, COORD);

    expect(saved[0].status).toBe(ActivityStatus.TODO);
    expect(saved[0].responsibleStaffId).toBe('staff-in');
  });

  it('COORDINATOR de outra casa → 404', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.REQUESTED, houseId: 'house-2' }),
    );
    const service = makeService(repo, story220Staff());

    await expect(
      service.changeStatus(
        'act-1',
        { status: ActivityStatus.TODO, responsibleStaffId: 'staff-out' },
        COORD,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SERVANT da casa → 403', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.REQUESTED }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.changeStatus(
        'act-1',
        { status: ActivityStatus.TODO, responsibleStaffId: 'staff-in' },
        SERVANT,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('COORDINATOR com responsável de outra casa → 400', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.REQUESTED }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.changeStatus(
        'act-1',
        { status: ActivityStatus.TODO, responsibleStaffId: 'staff-out' },
        COORD,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('COORDINATOR com responsável inexistente → 400', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.REQUESTED }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.changeStatus(
        'act-1',
        { status: ActivityStatus.TODO, responsibleStaffId: 'ghost' },
        COORD,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('COORDINATOR sem responsável nenhum → 400', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.REQUESTED }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.TODO }, COORD),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ADMIN segue aprovando com staff de qualquer casa (regressão)', async () => {
    const { repo, saved } = story220Repo(
      activity({ status: ActivityStatus.REQUESTED, houseId: 'house-1' }),
    );
    const service = makeService(repo, story220Staff());

    await service.changeStatus(
      'act-1',
      { status: ActivityStatus.TODO, responsibleStaffId: 'staff-out' },
      ADMIN,
    );

    expect(saved[0].status).toBe(ActivityStatus.TODO);
    expect(saved[0].responsibleStaffId).toBe('staff-out');
  });

  it('aprovação que define o responsável grava RESPONSIBLE_CHANGED e depois STATUS_CHANGED', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.REQUESTED }));
    const events = makeEvents();
    const service = makeService(repo, story220Staff(), events);

    await service.changeStatus(
      'act-1',
      { status: ActivityStatus.TODO, responsibleStaffId: 'staff-in' },
      COORD,
    );

    expect(events.record.mock.calls.map((c) => [c[1], c[3]])).toEqual([
      [ActivityEventType.RESPONSIBLE_CHANGED, { from: null, to: 'staff-in' }],
      [
        ActivityEventType.STATUS_CHANGED,
        { from: ActivityStatus.REQUESTED, to: ActivityStatus.TODO },
      ],
    ]);
  });

  it('aprovação que troca o responsável grava { from, to } do anterior', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.REQUESTED, responsibleStaffId: 'staff-in' }),
    );
    const events = makeEvents();
    const service = makeService(repo, story220Staff(), events);

    await service.changeStatus(
      'act-1',
      { status: ActivityStatus.TODO, responsibleStaffId: 'staff-in-2' },
      COORD,
    );

    expect(events.record.mock.calls[0][1]).toBe(ActivityEventType.RESPONSIBLE_CHANGED);
    expect(events.record.mock.calls[0][3]).toEqual({ from: 'staff-in', to: 'staff-in-2' });
    expect(events.record.mock.calls[1][1]).toBe(ActivityEventType.STATUS_CHANGED);
  });

  it('aprovação com o mesmo responsável não grava RESPONSIBLE_CHANGED', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.REQUESTED, responsibleStaffId: 'staff-in' }),
    );
    const events = makeEvents();
    const service = makeService(repo, story220Staff(), events);

    await service.changeStatus(
      'act-1',
      { status: ActivityStatus.TODO, responsibleStaffId: 'staff-in' },
      COORD,
    );

    expect(events.record).toHaveBeenCalledTimes(1);
    expect(events.record.mock.calls[0][1]).toBe(ActivityEventType.STATUS_CHANGED);
  });
});

describe('ActivityService.update — trocar responsável (story 220)', () => {
  it.each([
    ActivityStatus.DRAFT,
    ActivityStatus.REQUESTED,
    ActivityStatus.TODO,
    ActivityStatus.DOING,
    ActivityStatus.BLOCKED,
  ])('COORDINATOR da casa troca em %s → ok + RESPONSIBLE_CHANGED', async (status) => {
    const { repo, saved } = story220Repo(
      activity({ status, responsibleStaffId: 'staff-in', createdByUserId: 'other-user' }),
    );
    const events = makeEvents();
    const service = makeService(repo, story220Staff(), events);

    await service.update('act-1', { responsibleStaffId: 'staff-in-2' }, COORD);

    expect(saved[0].responsibleStaffId).toBe('staff-in-2');
    expect(events.record).toHaveBeenCalledWith(
      'act-1',
      ActivityEventType.RESPONSIBLE_CHANGED,
      COORD,
      { from: 'staff-in', to: 'staff-in-2' },
    );
  });

  it('descarta a relação carregada ao trocar (senão o TypeORM grava o responsável antigo)', async () => {
    const { repo, saved } = story220Repo(
      activity({
        status: ActivityStatus.TODO,
        responsibleStaffId: 'staff-in',
        responsible: { id: 'staff-in', name: 'Antigo' } as Staff,
      }),
    );
    const service = makeService(repo, story220Staff());

    await service.update('act-1', { responsibleStaffId: 'staff-in-2' }, COORD);

    expect(saved[0].responsibleStaffId).toBe('staff-in-2');
    expect(saved[0].responsible).toBeUndefined();
  });

  it('COORDINATOR em DONE → 403', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.DONE, responsibleStaffId: 'staff-in' }),
    );
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: 'staff-in-2' }, COORD),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ADMIN em DONE → ok (decisão 4)', async () => {
    const { repo, saved } = story220Repo(
      activity({ status: ActivityStatus.DONE, responsibleStaffId: 'staff-in' }),
    );
    const service = makeService(repo, story220Staff());

    await service.update('act-1', { responsibleStaffId: 'staff-out' }, ADMIN);

    expect(saved[0].responsibleStaffId).toBe('staff-out');
  });

  it('ADMIN com staff inexistente → 400', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.TODO }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: 'ghost' }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('COORDINATOR com responsável de outra casa → 400', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.TODO }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: 'staff-out' }, COORD),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('COORDINATOR em atividade sem casa (ADMIN-only) → 404', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.TODO, houseId: null }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: 'staff-in' }, COORD),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SERVANT → 403', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.TODO }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: 'staff-in' }, SERVANT),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ActivityStatus.TODO,
    ActivityStatus.DOING,
    ActivityStatus.BLOCKED,
    ActivityStatus.DONE,
  ])('null em %s → 400 (decisão 6, inclusive ADMIN)', async (status) => {
    const { repo } = story220Repo(activity({ status, responsibleStaffId: 'staff-in' }));
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: null }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('null em TODO pelo coordenador → 400', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.TODO, responsibleStaffId: 'staff-in' }),
    );
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: null }, COORD),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([ActivityStatus.DRAFT, ActivityStatus.REQUESTED])(
    'null em %s → ok',
    async (status) => {
      const { repo, saved } = story220Repo(
        activity({ status, responsibleStaffId: 'staff-in' }),
      );
      const service = makeService(repo, story220Staff());

      await service.update('act-1', { responsibleStaffId: null }, COORD);

      expect(saved[0].responsibleStaffId).toBeNull();
    },
  );

  it('coordenador mandando só responsável fora de DRAFT não cai na trava de título/casa', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.DOING, createdByUserId: 'other-user', responsibleStaffId: 'staff-in' }),
    );
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: 'staff-in-2' }, COORD),
    ).resolves.toBeDefined();
  });

  it('coordenador NÃO ganha edição de título fora de DRAFT (regressão story 48)', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.TODO, createdByUserId: 'other-user' }),
    );
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { title: 'novo', responsibleStaffId: 'staff-in' }, COORD),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('coordenador NÃO ganha edição de casa fora de DRAFT (regressão story 48)', async () => {
    const { repo } = story220Repo(
      activity({ status: ActivityStatus.REQUESTED, createdByUserId: 'other-user' }),
    );
    const service = makeService(repo, story220Staff());

    await expect(
      service.update('act-1', { houseId: 'house-2' }, COORD),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('COORDINATOR com responsável desligado → 400', async () => {
    const { repo } = story220Repo(activity({ status: ActivityStatus.TODO }));
    const service = makeService(repo, story224Staff());

    await expect(
      service.update('act-1', { responsibleStaffId: 'staff-dismissed' }, COORD),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── Story 224: criar por coluna com responsável ──────────────────────────────

/** story220Staff + um servo desligado na house-1. */
function story224Staff() {
  return makeStaffRepo(
    {
      'coord-user': { houseId: 'house-1' },
      'servant-user': { houseId: 'house-1' },
    },
    {
      'staff-in': { id: 'staff-in', userId: 'u-in', houseId: 'house-1' } as Staff,
      'staff-out': { id: 'staff-out', userId: 'u-out', houseId: 'house-2' } as Staff,
      'staff-dismissed': {
        id: 'staff-dismissed',
        userId: 'u-dis',
        houseId: 'house-1',
        dismissedAt: '2026-01-01',
      } as unknown as Staff,
    },
  );
}

/** Repo de criação que captura o que foi passado ao `create`. */
function createRepo() {
  const created: Partial<Activity>[] = [];
  const repo = makeActivityRepo({
    create: jest.fn().mockImplementation((v) => {
      created.push(v);
      return v;
    }),
    findOne: jest.fn().mockResolvedValue(activity()),
  });
  return { repo, created };
}

describe('ActivityService.create — matriz role × status (story 224)', () => {
  const withResponsible = (status: ActivityStatus) =>
    status === ActivityStatus.TODO ? { responsibleStaffId: 'staff-in' } : {};

  it('SERVANT cria DRAFT', async () => {
    const { repo, created } = createRepo();
    const service = makeService(repo, story224Staff());

    await service.create(
      { title: 'x', houseId: 'house-1', status: ActivityStatus.DRAFT },
      SERVANT,
    );

    expect(created[0].status).toBe(ActivityStatus.DRAFT);
  });

  it.each([ActivityStatus.REQUESTED, ActivityStatus.TODO])(
    'SERVANT em %s → 403',
    async (status) => {
      const { repo } = createRepo();
      const service = makeService(repo, story224Staff());

      await expect(
        service.create(
          { title: 'x', houseId: 'house-1', status, ...withResponsible(status) },
          SERVANT,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    },
  );

  it.each([ActivityStatus.DRAFT, ActivityStatus.REQUESTED, ActivityStatus.TODO])(
    'COORDINATOR da casa cria em %s',
    async (status) => {
      const { repo, created } = createRepo();
      const service = makeService(repo, story224Staff());

      await service.create(
        { title: 'x', houseId: 'house-1', status, ...withResponsible(status) },
        COORD,
      );

      expect(created[0].status).toBe(status);
    },
  );

  it.each([ActivityStatus.REQUESTED, ActivityStatus.TODO])(
    'COORDINATOR com houseId de outra casa em %s → 403',
    async (status) => {
      const { repo } = createRepo();
      const service = makeService(repo, story224Staff());

      await expect(
        service.create(
          { title: 'x', houseId: 'house-2', status, ...withResponsible(status) },
          COORD,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each([ActivityStatus.DRAFT, ActivityStatus.REQUESTED, ActivityStatus.TODO])(
    'ADMIN cria em %s',
    async (status) => {
      const { repo, created } = createRepo();
      const service = makeService(repo, story224Staff());

      await service.create({ title: 'x', status, ...withResponsible(status) }, ADMIN);

      expect(created[0].status).toBe(status);
    },
  );

  it.each([ActivityStatus.DOING, ActivityStatus.BLOCKED, ActivityStatus.DONE])(
    '%s na criação → 400 no service (defesa em profundidade)',
    async (status) => {
      const { repo } = createRepo();
      const service = makeService(repo, story224Staff());

      await expect(
        service.create({ title: 'x', status, responsibleStaffId: 'staff-in' }, ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

describe('CreateActivityDto — status (story 224)', () => {
  const errorsFor = async (status: string) => {
    const dto = plainToInstance(CreateActivityDto, { title: 'x', status });
    const errors = await validate(dto);
    return errors.filter((e) => e.property === 'status');
  };

  it.each([ActivityStatus.DRAFT, ActivityStatus.REQUESTED, ActivityStatus.TODO])(
    'aceita %s',
    async (status) => {
      expect(await errorsFor(status)).toHaveLength(0);
    },
  );

  it.each([ActivityStatus.DOING, ActivityStatus.BLOCKED, ActivityStatus.DONE])(
    'rejeita %s (400)',
    async (status) => {
      expect(await errorsFor(status)).toHaveLength(1);
    },
  );
});

describe('ActivityService.create — responsável (story 224)', () => {
  it.each([
    ['COORDINATOR', COORD],
    ['ADMIN', ADMIN],
  ])('%s em TODO sem responsável → 400', async (_label, user) => {
    const { repo } = createRepo();
    const service = makeService(repo, story224Staff());

    await expect(
      service.create({ title: 'x', houseId: 'house-1', status: ActivityStatus.TODO }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SERVANT cria DRAFT com responsável da casa → salvo', async () => {
    const { repo, created } = createRepo();
    const service = makeService(repo, story224Staff());

    await service.create(
      { title: 'x', houseId: 'house-1', responsibleStaffId: 'staff-in' },
      SERVANT,
    );

    expect(created[0].status).toBe(ActivityStatus.DRAFT);
    expect(created[0].responsibleStaffId).toBe('staff-in');
  });

  it.each([
    ['de outra casa', 'staff-out'],
    ['desligado', 'staff-dismissed'],
    ['inexistente', 'ghost'],
  ])('não-ADMIN com responsável %s → 400', async (_label, staffId) => {
    const { repo } = createRepo();
    const service = makeService(repo, story224Staff());

    await expect(
      service.create(
        { title: 'x', houseId: 'house-1', responsibleStaffId: staffId },
        SERVANT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('não-ADMIN com responsável em atividade sem casa → 400', async () => {
    const { repo } = createRepo();
    const service = makeService(repo, story224Staff());

    await expect(
      service.create({ title: 'x', responsibleStaffId: 'staff-in' }, SERVANT),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ADMIN com responsável de qualquer casa → ok (regressão)', async () => {
    const { repo, created } = createRepo();
    const service = makeService(repo, story224Staff());

    await service.create(
      {
        title: 'x',
        houseId: 'house-1',
        status: ActivityStatus.TODO,
        responsibleStaffId: 'staff-out',
      },
      ADMIN,
    );

    expect(created[0].responsibleStaffId).toBe('staff-out');
  });

  it('ADMIN com responsável inexistente → 400', async () => {
    const { repo } = createRepo();
    const service = makeService(repo, story224Staff());

    await expect(
      service.create({ title: 'x', responsibleStaffId: 'ghost' }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ActivityService.create — eventos (story 224)', () => {
  it('com responsável grava CREATED e depois RESPONSIBLE_CHANGED {from: null, to}', async () => {
    const { repo } = createRepo();
    const events = makeEvents();
    const service = makeService(repo, story224Staff(), events);

    await service.create(
      {
        title: 'x',
        houseId: 'house-1',
        status: ActivityStatus.TODO,
        responsibleStaffId: 'staff-in',
      },
      COORD,
    );

    expect(events.record.mock.calls).toEqual([
      ['act-1', ActivityEventType.CREATED, COORD],
      ['act-1', ActivityEventType.RESPONSIBLE_CHANGED, COORD, { from: null, to: 'staff-in' }],
    ]);
  });

  it('sem responsável grava só CREATED', async () => {
    const { repo } = createRepo();
    const events = makeEvents();
    const service = makeService(repo, story224Staff(), events);

    await service.create(
      { title: 'x', houseId: 'house-1', status: ActivityStatus.REQUESTED },
      COORD,
    );

    expect(events.record.mock.calls).toEqual([
      ['act-1', ActivityEventType.CREATED, COORD],
    ]);
  });
});
