jest.mock('@fonte/types', () => ({
  FamilyInvestment: {
    BASKET_500: 'BASKET_500',
    PAYMENT_700: 'PAYMENT_700',
    SOCIAL: 'SOCIAL',
    NEGOTIATED: 'NEGOTIATED',
  },
  ResidentStatus: {
    PRE_ADMISSION: 'PRE_ADMISSION',
    ACTIVE: 'ACTIVE',
    DISCIPLINE: 'DISCIPLINE',
    TEMP_LEAVE: 'TEMP_LEAVE',
    DISCHARGED: 'DISCHARGED',
    EVADED: 'EVADED',
  },
  ReceivableStatus: { PENDING: 'PENDING', PAID: 'PAID', CANCELED: 'CANCELED' },
  PaymentMethod: { CASH: 'CASH', PIX: 'PIX', CREDIT_CARD: 'CREDIT_CARD', DEBIT_CARD: 'DEBIT_CARD', BASKET: 'BASKET', OTHER: 'OTHER' },
}));

import { Repository } from 'typeorm';
import { ResidentReceivableService } from './resident-receivable.service';
import { ResidentReceivable } from './resident-receivable.entity';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';

interface MockRepo {
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
}

function makeRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
    create: jest.fn().mockImplementation((v) => v),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function makeResident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'res-1',
    status: 'ACTIVE',
    entryDate: '2026-01-15' as unknown as Date,
    familyInvestment: 'PAYMENT_700',
    familyInvestmentAmount: null,
    contributionDueDay: null,
    contributionExempt: false,
    ...overrides,
  } as Resident;
}

function makeService(repo: MockRepo, residentRepo: Partial<Repository<Resident>>) {
  return new ResidentReceivableService(
    repo as unknown as Repository<ResidentReceivable>,
    residentRepo as Repository<Resident>,
    {} as Repository<Staff>,
    {} as never, // StorageService
  );
}

describe('ResidentReceivableService.generateSchedule', () => {
  it('creates 6 mandatory installments from the entry month with the canonical amount', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved).toHaveLength(6);
    expect(saved.every((r) => r.mandatory)).toBe(true);
    expect(saved.every((r) => r.amount === 700)).toBe(true);
    expect(saved.map((r) => r.referenceMonth)).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
    ]);
    expect(saved[0].dueDate).toBe('2026-01-15');
  });

  it('uses familyInvestmentAmount for a NEGOTIATED plan', async () => {
    const repo = makeRepo();
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(
        makeResident({ familyInvestment: 'NEGOTIATED' as never, familyInvestmentAmount: 350 }),
      ),
    };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');

    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved.every((r) => r.amount === 350)).toBe(true);
  });

  it('skips months that already exist', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([{ referenceMonth: '2026-01-01' }, { referenceMonth: '2026-02-01' }]),
    });
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');

    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved).toHaveLength(4);
  });

  it('generates nothing for a SOCIAL plan', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident({ familyInvestment: 'SOCIAL' as never })) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('generates nothing for an exempt resident', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident({ contributionExempt: true })) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('ResidentReceivableService.ensureFutureOpen', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('rolls voluntary (non-mandatory) months beyond the 6-month window up to next month', async () => {
    const repo = makeRepo();
    const service = makeService(repo, {});

    // Entry Jan 2026 → mandatory Jan–Jun; now Sep → should fill Jul..Oct as voluntary.
    await service.ensureFutureOpen(makeResident());

    const saved = repo.save.mock.calls[0][0] as Array<{ referenceMonth: string; mandatory: boolean }>;
    const months = saved.map((r) => r.referenceMonth);
    expect(months).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
      '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01',
    ]);
    const july = saved.find((r) => r.referenceMonth === '2026-07-01')!;
    expect(july.mandatory).toBe(false);
    const june = saved.find((r) => r.referenceMonth === '2026-06-01')!;
    expect(june.mandatory).toBe(true);
  });
});

describe('ResidentReceivableService.cancelFuturePending', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('cancels only pending installments from the current month onward', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'a', referenceMonth: '2026-01-01' },
        { id: 'b', referenceMonth: '2026-03-01' },
        { id: 'c', referenceMonth: '2026-04-01' },
      ]),
    });
    const service = makeService(repo, {});

    await service.cancelFuturePending('res-1');

    expect(repo.update).toHaveBeenCalledTimes(1);
    const [criteria, patch] = repo.update.mock.calls[0];
    expect(patch).toEqual({ status: 'CANCELED' });
    // Only March and April (>= current month); January excluded.
    expect(criteria.id._value).toEqual(['b', 'c']);
  });
});
