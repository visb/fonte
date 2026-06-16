jest.mock('@fonte/types', () => ({
  PayableStatus: { OPEN: 'OPEN', PAID: 'PAID' },
  PayableCategory: {
    UTILITIES: 'UTILITIES',
    SUPPLIES: 'SUPPLIES',
    MAINTENANCE: 'MAINTENANCE',
    PAYROLL: 'PAYROLL',
    TAXES: 'TAXES',
    OTHER: 'OTHER',
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayableCategory, PayableStatus } from '@fonte/types';
import { Repository } from 'typeorm';
import { PayableService } from './payable.service';
import { Payable } from './payable.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PAYABLE_ID = 'payable-uuid';

function makePayable(overrides: Partial<Payable> = {}): Payable {
  return {
    id: PAYABLE_ID,
    description: 'Conta de luz',
    amount: 25000,
    dueDate: '2026-06-20',
    category: PayableCategory.UTILITIES,
    supplier: 'Enel',
    status: PayableStatus.OPEN,
    paidAt: null,
    notes: null,
    createdBy: 'user-uuid',
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as unknown as Payable;
}

// Chainable query-builder mock returning a fixed list.
function makeQb(items: Payable[] = []) {
  const qb: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'addOrderBy'].forEach((name) => {
    qb[name] = jest.fn().mockReturnValue(qb);
  });
  qb.getMany = jest.fn().mockResolvedValue(items);
  return qb;
}

function makeService(repoOverrides: Partial<Repository<Payable>> = {}) {
  return new PayableService(repoOverrides as Repository<Payable>);
}

const TODAY = '2026-06-16';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});

afterAll(() => {
  jest.useRealTimers();
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('PayableService.create', () => {
  it('persists with status OPEN and returns the view shape', async () => {
    const created = makePayable();
    const repo = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(created),
    };
    const service = makeService(repo as never);

    const result = await service.create(
      {
        description: 'Conta de luz',
        amount: 25000,
        dueDate: '2026-06-20',
        category: PayableCategory.UTILITIES,
        supplier: 'Enel',
      },
      'user-uuid',
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PayableStatus.OPEN, paidAt: null, createdBy: 'user-uuid' }),
    );
    expect(result.id).toBe(PAYABLE_ID);
    expect(result.status).toBe(PayableStatus.OPEN);
    expect(result.amount).toBe(25000);
    expect(result.overdue).toBe(false);
  });
});

// ─── findAll (filters) ──────────────────────────────────────────────────────────

describe('PayableService.findAll', () => {
  it('applies status, category and period filters to the query', async () => {
    const qb = makeQb([makePayable()]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = makeService(repo as never);

    await service.findAll({
      status: PayableStatus.OPEN,
      category: PayableCategory.UTILITIES,
      from: '2026-06-01',
      to: '2026-06-30',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('p.status = :status', { status: PayableStatus.OPEN });
    expect(qb.andWhere).toHaveBeenCalledWith('p.category = :category', {
      category: PayableCategory.UTILITIES,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('p.due_date >= :from', { from: '2026-06-01' });
    expect(qb.andWhere).toHaveBeenCalledWith('p.due_date <= :to', { to: '2026-06-30' });
  });

  it('marks OPEN payables past due as overdue (derived, not persisted)', async () => {
    const overduePast = makePayable({ id: 'a', dueDate: '2026-06-10', status: PayableStatus.OPEN });
    const futureOpen = makePayable({ id: 'b', dueDate: '2026-06-30', status: PayableStatus.OPEN });
    const paidPast = makePayable({
      id: 'c',
      dueDate: '2026-06-10',
      status: PayableStatus.PAID,
      paidAt: '2026-06-11',
    });
    const qb = makeQb([overduePast, futureOpen, paidPast]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = makeService(repo as never);

    const result = await service.findAll({});

    expect(result.find((p) => p.id === 'a')!.overdue).toBe(true);
    expect(result.find((p) => p.id === 'b')!.overdue).toBe(false);
    // Paga nunca é "vencida", mesmo com dueDate no passado.
    expect(result.find((p) => p.id === 'c')!.overdue).toBe(false);
  });
});

// ─── getSummary ─────────────────────────────────────────────────────────────────

describe('PayableService.getSummary', () => {
  it('aggregates open, paid and overdue totals and counts', async () => {
    const items = [
      makePayable({ id: 'a', amount: 10000, dueDate: '2026-06-10', status: PayableStatus.OPEN }), // overdue
      makePayable({ id: 'b', amount: 20000, dueDate: '2026-06-30', status: PayableStatus.OPEN }), // open, not overdue
      makePayable({ id: 'c', amount: 5000, status: PayableStatus.PAID, paidAt: '2026-06-05' }),
    ];
    const qb = makeQb(items);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = makeService(repo as never);

    const summary = await service.getSummary({});

    expect(summary.totalOpen).toBe(30000);
    expect(summary.countOpen).toBe(2);
    expect(summary.totalPaid).toBe(5000);
    expect(summary.countPaid).toBe(1);
    expect(summary.totalOverdue).toBe(10000);
    expect(summary.countOverdue).toBe(1);
  });

  it('passes period filters to the query', async () => {
    const qb = makeQb([]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = makeService(repo as never);

    await service.getSummary({ from: '2026-06-01', to: '2026-06-30' });

    expect(qb.andWhere).toHaveBeenCalledWith('p.due_date >= :from', { from: '2026-06-01' });
    expect(qb.andWhere).toHaveBeenCalledWith('p.due_date <= :to', { to: '2026-06-30' });
  });
});

// ─── pay (transition OPEN → PAID) ────────────────────────────────────────────────

describe('PayableService.pay', () => {
  it('transitions OPEN → PAID and sets paid_at to the given date', async () => {
    const payable = makePayable({ status: PayableStatus.OPEN });
    const repo = {
      findOne: jest.fn().mockResolvedValue(payable),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    const service = makeService(repo as never);

    const result = await service.pay(PAYABLE_ID, { paidAt: '2026-06-15' });

    expect(result.status).toBe(PayableStatus.PAID);
    expect(result.paidAt).toBe('2026-06-15');
  });

  it('defaults paid_at to today when no date is given', async () => {
    const payable = makePayable({ status: PayableStatus.OPEN });
    const repo = {
      findOne: jest.fn().mockResolvedValue(payable),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    const service = makeService(repo as never);

    const result = await service.pay(PAYABLE_ID, {});

    expect(result.status).toBe(PayableStatus.PAID);
    expect(result.paidAt).toBe(TODAY);
  });

  it('rejects paying an already-paid payable', async () => {
    const payable = makePayable({ status: PayableStatus.PAID, paidAt: '2026-06-01' });
    const repo = { findOne: jest.fn().mockResolvedValue(payable), save: jest.fn() };
    const service = makeService(repo as never);

    await expect(service.pay(PAYABLE_ID, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown id', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const service = makeService(repo as never);

    await expect(service.pay('missing', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── remove (soft delete) ────────────────────────────────────────────────────────

describe('PayableService.remove', () => {
  it('soft-removes an existing payable', async () => {
    const payable = makePayable();
    const repo = {
      findOne: jest.fn().mockResolvedValue(payable),
      softRemove: jest.fn().mockResolvedValue(payable),
    };
    const service = makeService(repo as never);

    await service.remove(PAYABLE_ID);

    expect(repo.softRemove).toHaveBeenCalledWith(payable);
  });

  it('throws NotFound when the payable does not exist', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), softRemove: jest.fn() };
    const service = makeService(repo as never);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.softRemove).not.toHaveBeenCalled();
  });
});

// ─── update ──────────────────────────────────────────────────────────────────────

describe('PayableService.update', () => {
  it('applies partial changes and returns the updated view', async () => {
    const payable = makePayable();
    const repo = {
      findOne: jest.fn().mockResolvedValue(payable),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    const service = makeService(repo as never);

    const result = await service.update(PAYABLE_ID, { amount: 30000, supplier: 'CELG' });

    expect(result.amount).toBe(30000);
    expect(result.supplier).toBe('CELG');
  });
});
