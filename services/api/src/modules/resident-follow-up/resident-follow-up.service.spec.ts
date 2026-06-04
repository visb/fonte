jest.mock('@fonte/types', () => ({
  Role: { ADMIN: 'ADMIN', COORDINATOR: 'COORDINATOR', SERVANT: 'SERVANT' },
  ResidentStatus: { ACTIVE: 'ACTIVE', DISCHARGED: 'DISCHARGED', EVADED: 'EVADED' },
  FollowUpType: {
    ADMISSION: 'ADMISSION',
    DISCHARGE: 'DISCHARGE',
    EVASION: 'EVASION',
    MONTHLY_CONTRIBUTION: 'MONTHLY_CONTRIBUTION',
    NOTE: 'NOTE',
  },
  FollowUpAccessLevel: { ALL: 'ALL', ADMINISTRATION: 'ADMINISTRATION' },
}));

import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ResidentFollowUpService } from './resident-follow-up.service';
import { ResidentFollowUp } from './resident-follow-up.entity';
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';
import { StorageService } from '../storage/storage.service';

function makeQb(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  return qb;
}

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve(Array.isArray(v) ? v : { id: 'fu-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(makeQb([])),
    ...overrides,
  };
}

function makeService(
  repo: ReturnType<typeof makeRepo>,
  staffRepo = makeRepo(),
  residentRepo = makeRepo(),
  storage: Partial<StorageService> = {},
) {
  return new ResidentFollowUpService(
    repo as unknown as Repository<ResidentFollowUp>,
    staffRepo as unknown as Repository<Staff>,
    residentRepo as unknown as Repository<Resident>,
    storage as StorageService,
  );
}

describe('ResidentFollowUpService.findByResident', () => {
  it('restricts SERVANT to ALL-level entries', async () => {
    const qb = makeQb([]);
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    await service.findByResident('res-1', 'SERVANT');

    expect(qb.andWhere).toHaveBeenCalledWith('f.access_level = :level', { level: 'ALL' });
  });

  it('does not restrict access level for COORDINATOR', async () => {
    const qb = makeQb([]);
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    await service.findByResident('res-1', 'COORDINATOR');

    const accessCalls = qb.andWhere.mock.calls.filter((c) => String(c[0]).includes('access_level'));
    expect(accessCalls).toHaveLength(0);
  });
});

describe('ResidentFollowUpService.create', () => {
  it('updates resident status on a DISCHARGE event', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'fu-1', createdBy: null }) });
    const residentRepo = makeRepo();
    const service = makeService(repo, makeRepo(), residentRepo);

    await service.create('res-1', { date: '2026-06-01', type: 'DISCHARGE', accessLevel: 'ALL' } as never, 'user-1');

    expect(residentRepo.update).toHaveBeenCalledWith('res-1', { status: 'DISCHARGED', exitDate: '2026-06-01' });
  });

  it('does not change status for a NOTE event', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'fu-1', createdBy: null }) });
    const residentRepo = makeRepo();
    const service = makeService(repo, makeRepo(), residentRepo);

    await service.create('res-1', { date: '2026-06-01', type: 'NOTE', accessLevel: 'ALL' } as never, 'user-1');

    expect(residentRepo.update).not.toHaveBeenCalled();
  });
});

describe('ResidentFollowUpService.bulkCreateContributions', () => {
  it('skips months that already have a contribution entry', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([{ date: '2026-01-10' }]),
    });
    const service = makeService(repo);

    const result = await service.bulkCreateContributions(
      'res-1',
      { months: [{ date: '2026-01-15' }, { date: '2026-02-15' }] } as never,
      'user-1',
    );

    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('creates nothing when all months exist', async () => {
    const repo = makeRepo({ find: jest.fn().mockResolvedValue([{ date: '2026-03-10' }]) });
    const service = makeService(repo);

    const result = await service.bulkCreateContributions('res-1', { months: [{ date: '2026-03-20' }] } as never, 'user-1');

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('ResidentFollowUpService.createAuto', () => {
  it('persists an ALL-level entry with no author', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.createAuto('res-1', 'ADMISSION' as never, '2026-06-01');

    const created = repo.create.mock.calls[0][0];
    expect(created).toMatchObject({ residentId: 'res-1', type: 'ADMISSION', accessLevel: 'ALL', createdById: null });
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('ResidentFollowUpService.uploadAttachment', () => {
  it('throws NotFound when the follow-up is missing', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo);
    await expect(
      service.uploadAttachment('fu-1', 'res-1', { originalname: 'x.pdf', buffer: Buffer.from(''), mimetype: 'application/pdf' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replaces an existing attachment', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'fu-1', residentId: 'res-1', attachmentUrl: 'old.pdf' })
        .mockResolvedValue({ id: 'fu-1', createdBy: null }),
    });
    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn().mockReturnValue('new.pdf'),
      upload: jest.fn().mockResolvedValue('https://cdn/new.pdf'),
    };
    const service = makeService(repo, makeRepo(), makeRepo(), storage as never);

    await service.uploadAttachment('fu-1', 'res-1', { originalname: 'x.pdf', buffer: Buffer.from(''), mimetype: 'application/pdf' } as never);

    expect(storage.delete).toHaveBeenCalledWith('old.pdf');
    expect(repo.update).toHaveBeenCalledWith('fu-1', { attachmentUrl: 'https://cdn/new.pdf' });
  });
});
