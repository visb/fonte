jest.mock('@fonte/types', () => ({
  AssociateStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  SubscriptionStatus: { ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  ChargeStatus: { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' },
}));

import { AssociateStatus } from '@fonte/types';
import { ObjectLiteral, Repository } from 'typeorm';
import { AssociateService } from './associate.service';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';

// ─── Factories ────────────────────────────────────────────────────────────────

const ASSOCIATE_ID = 'associate-uuid';

function makeAssociate(overrides: Partial<Associate> = {}): Associate {
  return {
    id: ASSOCIATE_ID,
    name: 'João Doador',
    whatsapp: '+5562999998888',
    email: 'joao@example.com',
    contributionAmount: 50,
    dueDay: 10,
    status: AssociateStatus.PENDING,
    gatewayCustomerId: null,
    paymentToken: 'token-uuid',
    subscriptions: [],
    charges: [],
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as unknown as Associate;
}

function makeService(
  repoOverrides: Partial<Repository<Associate>> = {},
  subRepoOverrides: Partial<Repository<AssociateSubscription>> = {},
  chargeRepoOverrides: Partial<Repository<AssociateCharge>> = {},
) {
  return new AssociateService(
    repoOverrides as Repository<Associate>,
    subRepoOverrides as Repository<AssociateSubscription>,
    chargeRepoOverrides as Repository<AssociateCharge>,
  );
}

// ─── create ──────────────────────────────────────────────────────────────────

describe('AssociateService.create', () => {
  const dto = {
    name: 'João Doador',
    whatsapp: '+5562999998888',
    email: 'joao@example.com',
    contributionAmount: 50,
    dueDay: 10,
  };

  it('generates a payment_token and starts with status PENDING', async () => {
    const saved = makeAssociate();
    const repo: Partial<Repository<Associate>> = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(saved),
    };

    const service = makeService(repo);
    const result = await service.create(dto);

    const createArg = (repo.create as jest.Mock).mock.calls[0][0];
    expect(createArg.status).toBe(AssociateStatus.PENDING);
    expect(typeof createArg.paymentToken).toBe('string');
    expect(createArg.paymentToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.status).toBe(AssociateStatus.PENDING);
    expect(result.paymentToken).toBe('token-uuid');
  });

  it('persists the provided fields', async () => {
    const repo: Partial<Repository<Associate>> = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(makeAssociate()),
    };

    const service = makeService(repo);
    await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'João Doador',
        whatsapp: '+5562999998888',
        email: 'joao@example.com',
        contributionAmount: 50,
        dueDay: 10,
      }),
    );
  });

  it('stores null email when omitted', async () => {
    const repo: Partial<Repository<Associate>> = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(makeAssociate({ email: null })),
    };

    const service = makeService(repo);
    await service.create({ ...dto, email: undefined });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it('returns the view shape (numeric coerced)', async () => {
    const saved = makeAssociate({ contributionAmount: 99.9 as unknown as number });
    const repo: Partial<Repository<Associate>> = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(saved),
    };

    const service = makeService(repo);
    const result = await service.create(dto);

    expect(result).toMatchObject({
      id: ASSOCIATE_ID,
      name: 'João Doador',
      whatsapp: '+5562999998888',
      dueDay: 10,
    });
    expect(typeof result.contributionAmount).toBe('number');
    expect(typeof result.createdAt).toBe('string');
  });
});

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('AssociateService.findAll', () => {
  it('returns associates ordered with their last charge', async () => {
    const repo: Partial<Repository<Associate>> = {
      find: jest.fn().mockResolvedValue([makeAssociate()]),
    };
    const chargeRepo: Partial<Repository<AssociateCharge>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const service = makeService(repo, {}, chargeRepo);
    const result = await service.findAll();

    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    expect(result).toHaveLength(1);
    expect(result[0].lastCharge).toBeNull();
    expect(result[0].id).toBe(ASSOCIATE_ID);
  });
});

// ─── findOne ─────────────────────────────────────────────────────────────────

describe('AssociateService.findOne', () => {
  it('returns detail with subscription and charges', async () => {
    const repo: Partial<Repository<Associate>> = {
      findOne: jest.fn().mockResolvedValue(makeAssociate()),
    };
    const subRepo: Partial<Repository<AssociateSubscription>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const chargeRepo: Partial<Repository<AssociateCharge>> = {
      find: jest.fn().mockResolvedValue([]),
    };

    const service = makeService(repo, subRepo, chargeRepo);
    const result = await service.findOne(ASSOCIATE_ID);

    expect(result.id).toBe(ASSOCIATE_ID);
    expect(result.subscription).toBeNull();
    expect(result.charges).toEqual([]);
  });

  it('throws NotFoundException when missing', async () => {
    const repo: Partial<Repository<Associate>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = makeService(repo);
    await expect(service.findOne('no-id')).rejects.toThrow('Associate not found');
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('AssociateService.update', () => {
  it('updates provided fields and saves', async () => {
    const existing = makeAssociate();
    const repo: Partial<Repository<Associate>> = {
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
    };

    const service = makeService(repo);
    const result = await service.update(ASSOCIATE_ID, { name: 'Novo Nome', dueDay: 20 });

    expect(repo.save).toHaveBeenCalled();
    expect(result.name).toBe('Novo Nome');
    expect(result.dueDay).toBe(20);
  });

  it('throws NotFoundException when missing', async () => {
    const repo: Partial<Repository<Associate>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = makeService(repo);
    await expect(service.update('no-id', { name: 'x' })).rejects.toThrow('Associate not found');
  });
});

// ─── getOverview ───────────────────────────────────────────────────────────────

/**
 * Cria um stub de QueryBuilder encadeável que devolve, em ordem, os resultados de
 * `getRawMany` / `getCount` enfileirados. Cada `createQueryBuilder()` consome o
 * próximo resultado da fila — sem N+1 por linha, espelha as consultas agregadas.
 */
function makeChainRepo<T extends ObjectLiteral>(results: Array<unknown>): Partial<Repository<T>> {
  let i = 0;
  const next = () => results[i++];
  const qb: Record<string, unknown> = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getRawMany = jest.fn().mockImplementation(() => Promise.resolve(next()));
  qb.getCount = jest.fn().mockImplementation(() => Promise.resolve(next()));
  return { createQueryBuilder: jest.fn().mockImplementation(() => qb) } as Partial<Repository<T>>;
}

describe('AssociateService.getOverview', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-16T12:00:00Z'));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('builds the requested number of months ending in the current month', async () => {
    const repo = makeChainRepo<Associate>([0, 0, 0]); // newAssociates, nonCanceled, pastDue
    const subRepo = makeChainRepo<AssociateSubscription>([0, 0, 0]); // active, churn, activeAtStart
    const chargeRepo = makeChainRepo<AssociateCharge>([[], [], 0]); // expected, collected, delinquent

    const service = makeService(repo, subRepo, chargeRepo);
    const result = await service.getOverview(3);

    expect(result.months).toHaveLength(3);
    expect(result.months.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06']);
  });

  it('defaults to 12 months', async () => {
    const repo = makeChainRepo<Associate>([0, 0, 0]);
    const subRepo = makeChainRepo<AssociateSubscription>([0, 0, 0]);
    const chargeRepo = makeChainRepo<AssociateCharge>([[], [], 0]);

    const service = makeService(repo, subRepo, chargeRepo);
    const result = await service.getOverview();

    expect(result.months).toHaveLength(12);
    expect(result.months[0].month).toBe('2025-07');
    expect(result.months[11].month).toBe('2026-06');
  });

  it('maps expected (due_date) and collected (paid) sums per month', async () => {
    const repo = makeChainRepo<Associate>([0, 0, 0]);
    const subRepo = makeChainRepo<AssociateSubscription>([0, 0, 0]);
    const chargeRepo = makeChainRepo<AssociateCharge>([
      // expected rows
      [{ month: '2026-06', gross: '100.00', net: '90.00' }],
      // collected rows
      [{ month: '2026-06', gross: '50.00', net: '45.00' }],
      // delinquent count
      0,
    ]);

    const service = makeService(repo, subRepo, chargeRepo);
    const result = await service.getOverview(1);

    expect(result.months[0]).toEqual({
      month: '2026-06',
      expectedGross: 100,
      expectedNet: 90,
      collectedGross: 50,
      collectedNet: 45,
    });
    expect(result.current.expectedGross).toBe(100);
    expect(result.current.collectedNet).toBe(45);
  });

  it('computes churn and recurrence rates from counts', async () => {
    // newAssociates=2, nonCanceled=10, pastDue=1
    const repo = makeChainRepo<Associate>([2, 10, 1]);
    // active=8, churn=2, activeAtStart=8
    const subRepo = makeChainRepo<AssociateSubscription>([8, 2, 8]);
    const chargeRepo = makeChainRepo<AssociateCharge>([[], [], 3]); // delinquent=3

    const service = makeService(repo, subRepo, chargeRepo);
    const result = await service.getOverview(1);

    expect(result.current.newAssociates).toBe(2);
    expect(result.current.activeSubscriptions).toBe(8);
    expect(result.current.recurrenceRate).toBeCloseTo(0.8, 5);
    expect(result.current.churnCount).toBe(2);
    expect(result.current.churnRate).toBeCloseTo(0.25, 5);
    expect(result.current.delinquentCharges).toBe(3);
    expect(result.current.pastDueAssociates).toBe(1);
  });

  it('returns zeroed indices for a month without data (no division by zero)', async () => {
    const repo = makeChainRepo<Associate>([0, 0, 0]);
    const subRepo = makeChainRepo<AssociateSubscription>([0, 0, 0]);
    const chargeRepo = makeChainRepo<AssociateCharge>([[], [], 0]);

    const service = makeService(repo, subRepo, chargeRepo);
    const result = await service.getOverview(1);

    expect(result.current).toMatchObject({
      expectedGross: 0,
      expectedNet: 0,
      collectedGross: 0,
      collectedNet: 0,
      newAssociates: 0,
      activeSubscriptions: 0,
      recurrenceRate: 0,
      churnCount: 0,
      churnRate: 0,
      delinquentCharges: 0,
      pastDueAssociates: 0,
    });
    expect(result.months[0]).toMatchObject({
      expectedGross: 0,
      collectedGross: 0,
    });
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('AssociateService.remove', () => {
  it('soft deletes an existing associate', async () => {
    const repo: Partial<Repository<Associate>> = {
      findOne: jest.fn().mockResolvedValue(makeAssociate()),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    const service = makeService(repo);
    await service.remove(ASSOCIATE_ID);
    expect(repo.softDelete).toHaveBeenCalledWith(ASSOCIATE_ID);
  });

  it('throws NotFoundException when missing', async () => {
    const repo: Partial<Repository<Associate>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = makeService(repo);
    await expect(service.remove('no-id')).rejects.toThrow('Associate not found');
  });
});
