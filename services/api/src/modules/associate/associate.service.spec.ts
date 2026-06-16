jest.mock('@fonte/types', () => ({
  AssociateStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  SubscriptionStatus: { ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  ChargeStatus: { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' },
}));

import { AssociateStatus } from '@fonte/types';
import { Repository } from 'typeorm';
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
    abacatepayCustomerId: null,
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
