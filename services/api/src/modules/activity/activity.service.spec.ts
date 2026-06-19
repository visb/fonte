import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivityStatus, Role } from '@fonte/types';
import { ActivityService, ActivityUser } from './activity.service';
import { Activity } from './activity.entity';
import { Staff } from '../staff/staff.entity';

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

function makeService(
  activityRepo: ReturnType<typeof makeActivityRepo>,
  staffRepo: ReturnType<typeof makeStaffRepo> = makeStaffRepo(),
) {
  return new ActivityService(
    activityRepo as unknown as Repository<Activity>,
    staffRepo as unknown as Repository<Staff>,
  );
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
  it('ops (non-admin) is forced to DRAFT even if it asks for TODO', async () => {
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

  it('REQUESTED → TODO only by ADMIN', async () => {
    const repo = makeActivityRepo({
      findOne: jest.fn().mockResolvedValue(activity({ status: ActivityStatus.REQUESTED })),
    });
    const staff = makeStaffRepo({ 'coord-user': { houseId: 'house-1' } });
    const service = makeService(repo, staff);

    await expect(
      service.changeStatus('act-1', { status: ActivityStatus.TODO, responsibleStaffId: 'staff-9' }, COORD),
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
