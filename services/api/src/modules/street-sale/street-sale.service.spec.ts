jest.mock('@fonte/types', () => ({
  StreetSaleType: { BREAD: 'BREAD', PIZZA: 'PIZZA' },
}));

import { StreetSaleType } from '@fonte/types';
import { Repository } from 'typeorm';
import { StreetSaleService } from './street-sale.service';
import { StreetSale } from './street-sale.entity';
import { Staff } from '../staff/staff.entity';

// ─── Factories ────────────────────────────────────────────────────────────────

const HOUSE_A = 'house-a-uuid';
const HOUSE_B = 'house-b-uuid';
const STAFF_ID = 'staff-uuid';
const SALE_ID = 'sale-uuid';

function makeSale(overrides: Partial<StreetSale> = {}): StreetSale {
  return {
    id: SALE_ID,
    houseId: HOUSE_A,
    house: { id: HOUSE_A, name: 'Casa Alpha' } as never,
    registeredById: STAFF_ID,
    registeredBy: null,
    date: '2026-05-15',
    type: StreetSaleType.BREAD,
    quantity: 40,
    amountPix: 10000,
    amountCash: 8000,
    amountCard: 5000,
    createdAt: new Date('2026-05-15T12:00:00Z'),
    updatedAt: new Date('2026-05-15T12:00:00Z'),
    ...overrides,
  } as unknown as StreetSale;
}

// Chainable query-builder mock
function makeQb(items: StreetSale[] = []) {
  const qb: Record<string, jest.Mock> = {};
  const chain = (name: string) => { qb[name] = jest.fn().mockReturnValue(qb); };
  ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy'].forEach(chain);
  qb.getMany = jest.fn().mockResolvedValue(items);
  return qb;
}

function makeService(
  repoOverrides: Partial<Repository<StreetSale>> = {},
  staffRepoOverrides: Partial<Repository<Staff>> = {},
) {
  return new StreetSaleService(
    repoOverrides as Repository<StreetSale>,
    staffRepoOverrides as Repository<Staff>,
  );
}

// ─── create ──────────────────────────────────────────────────────────────────

describe('StreetSaleService.create', () => {
  const dto = {
    houseId: HOUSE_A,
    date: '2026-05-15',
    type: StreetSaleType.BREAD,
    quantity: 40,
    amountPix: 10000,
    amountCash: 8000,
    amountCard: 5000,
  };

  it('persists sale with correct fields and returns toView shape', async () => {
    const partialSale = makeSale();
    const savedSale = makeSale({ id: SALE_ID });

    const repo: Partial<Repository<StreetSale>> = {
      create: jest.fn().mockReturnValue(partialSale),
      save: jest.fn().mockResolvedValue(savedSale),
      findOne: jest.fn().mockResolvedValue(savedSale),
    };
    const staffRepo: Partial<Repository<Staff>> = {
      findOne: jest.fn().mockResolvedValue({ id: STAFF_ID }),
    };

    const service = makeService(repo, staffRepo);
    const result = await service.create(dto, 'user-uuid');

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      houseId: HOUSE_A,
      registeredById: STAFF_ID,
      date: '2026-05-15',
      type: StreetSaleType.BREAD,
      quantity: 40,
      amountPix: 10000,
      amountCash: 8000,
      amountCard: 5000,
    }));
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: SALE_ID }, relations: ['house'] });
    expect(result).toMatchObject({
      id: SALE_ID,
      houseId: HOUSE_A,
      houseName: 'Casa Alpha',
      registeredById: STAFF_ID,
      type: StreetSaleType.BREAD,
      quantity: 40,
      amountPix: 10000,
      amountCash: 8000,
      amountCard: 5000,
      totalAmount: 23000,
    });
  });

  it('sets registeredById to null when staff is not found', async () => {
    const partialSale = makeSale({ registeredById: null });
    const savedSale = makeSale({ registeredById: null });

    const repo: Partial<Repository<StreetSale>> = {
      create: jest.fn().mockReturnValue(partialSale),
      save: jest.fn().mockResolvedValue(savedSale),
      findOne: jest.fn().mockResolvedValue(savedSale),
    };
    const staffRepo: Partial<Repository<Staff>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const service = makeService(repo, staffRepo);
    await service.create(dto, 'unknown-user');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ registeredById: null }),
    );
  });

  it('looks up staff by userId from the JWT', async () => {
    const partialSale = makeSale();
    const repo: Partial<Repository<StreetSale>> = {
      create: jest.fn().mockReturnValue(partialSale),
      save: jest.fn().mockResolvedValue(partialSale),
      findOne: jest.fn().mockResolvedValue(partialSale),
    };
    const staffRepo: Partial<Repository<Staff>> = {
      findOne: jest.fn().mockResolvedValue({ id: STAFF_ID }),
    };

    const service = makeService(repo, staffRepo);
    await service.create(dto, 'user-abc');

    expect(staffRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-abc' } });
  });
});

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('StreetSaleService.findAll', () => {
  it('returns all sales mapped to view when no filters', async () => {
    const qb = makeQb([makeSale()]);
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const service = makeService(repo);
    const result = await service.findAll();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: SALE_ID, totalAmount: 23000 });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('adds houseId filter when provided', async () => {
    const qb = makeQb([]);
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const service = makeService(repo);
    await service.findAll(HOUSE_A);

    expect(qb.andWhere).toHaveBeenCalledWith('s.house_id = :houseId', { houseId: HOUSE_A });
  });

  it('adds type filter when provided', async () => {
    const qb = makeQb([]);
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const service = makeService(repo);
    await service.findAll(undefined, StreetSaleType.PIZZA);

    expect(qb.andWhere).toHaveBeenCalledWith('s.type = :type', { type: StreetSaleType.PIZZA });
  });

  it('applies both filters independently', async () => {
    const qb = makeQb([]);
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const service = makeService(repo);
    await service.findAll(HOUSE_A, StreetSaleType.BREAD);

    expect(qb.andWhere).toHaveBeenCalledTimes(2);
  });
});

// ─── getReport ───────────────────────────────────────────────────────────────

describe('StreetSaleService.getReport', () => {
  const MONTH = '2026-05';

  // For getReport with month=2026-05:
  //   - 1 main QBuilder call (prev+current month data)
  //   - 6 monthly QBuilder calls: 2025-12 → 2026-05
  function makeRepoWithQbs(mainItems: StreetSale[], monthlyItems: StreetSale[][] = []) {
    const monthly = [...monthlyItems];
    let mainUsed = false;
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        if (!mainUsed) {
          mainUsed = true;
          return makeQb(mainItems);
        }
        return makeQb(monthly.shift() ?? []);
      }),
    };
    return repo;
  }

  it('returns zero totals and empty by-house when no data', async () => {
    const repo = makeRepoWithQbs([], [[], [], [], [], [], []]);
    const service = makeService(repo);

    const result = await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    expect(result.currentPeriodTotal).toBe(0);
    expect(result.previousPeriodTotal).toBe(0);
    expect(result.byHouse).toHaveLength(0);
    expect(result.type).toBe(StreetSaleType.BREAD);
  });

  it('computes currentPeriodTotal from sales in the requested month', async () => {
    const currentSales = [
      makeSale({ date: '2026-05-10', amountPix: 5000, amountCash: 3000, amountCard: 2000 }),
      makeSale({ date: '2026-05-20', amountPix: 4000, amountCash: 2000, amountCard: 1000 }),
    ];

    const repo = makeRepoWithQbs(currentSales, [[], [], [], [], [], []]);
    const service = makeService(repo);

    const result = await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    // 10000 + 7000 = 17000
    expect(result.currentPeriodTotal).toBe(17000);
  });

  it('computes previousPeriodTotal from sales in the prior month', async () => {
    const prevSales = [
      makeSale({ date: '2026-04-15', amountPix: 6000, amountCash: 2000, amountCard: 2000 }),
    ];
    const currentSales = [
      makeSale({ date: '2026-05-10', amountPix: 1000, amountCash: 1000, amountCard: 1000 }),
    ];

    // Main query returns both prev and current
    const repo = makeRepoWithQbs([...prevSales, ...currentSales], [[], [], [], [], [], []]);
    const service = makeService(repo);

    const result = await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    expect(result.previousPeriodTotal).toBe(10000);
    expect(result.currentPeriodTotal).toBe(3000);
  });

  it('groups sales by house with correct sums', async () => {
    const sales = [
      // Alpha: two sales totalling 12000
      makeSale({ houseId: HOUSE_A, house: { id: HOUSE_A, name: 'Alpha' } as never, amountPix: 4000, amountCash: 3000, amountCard: 2000, quantity: 20 }),
      makeSale({ houseId: HOUSE_A, house: { id: HOUSE_A, name: 'Alpha' } as never, amountPix: 2000, amountCash: 1000, amountCard: 0, quantity: 10 }),
      // Beta: one sale totalling 15000 — highest, so sorted first
      makeSale({ houseId: HOUSE_B, house: { id: HOUSE_B, name: 'Beta' } as never, amountPix: 8000, amountCash: 4000, amountCard: 3000, quantity: 30 }),
    ];

    const repo = makeRepoWithQbs(sales, [[], [], [], [], [], []]);
    const service = makeService(repo);

    const result = await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    expect(result.byHouse).toHaveLength(2);

    const beta = result.byHouse[0]; // highest totalAmount first
    expect(beta.houseName).toBe('Beta');
    expect(beta.totalAmount).toBe(15000);
    expect(beta.totalQuantity).toBe(30);

    const alpha = result.byHouse[1];
    expect(alpha.houseName).toBe('Alpha');
    expect(alpha.totalPix).toBe(6000);
    expect(alpha.totalCash).toBe(4000);
    expect(alpha.totalCard).toBe(2000);
    expect(alpha.totalAmount).toBe(12000);
    expect(alpha.totalQuantity).toBe(30);
  });

  it('splits weekly totals into 7-day windows within the month', async () => {
    // May 2026: weeks start May 1, 8, 15, 22, 29
    const sales = [
      makeSale({ date: '2026-05-05', amountPix: 2000, amountCash: 1000, amountCard: 500, quantity: 10 }), // week 1
      makeSale({ date: '2026-05-12', amountPix: 3000, amountCash: 2000, amountCard: 1000, quantity: 15 }), // week 2
    ];

    const repo = makeRepoWithQbs(sales, [[], [], [], [], [], []]);
    const service = makeService(repo);

    const result = await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    expect(result.weeklyTotals[0].period).toBe('2026-05-01');
    expect(result.weeklyTotals[0].totalAmount).toBe(3500);
    expect(result.weeklyTotals[0].totalQuantity).toBe(10);

    expect(result.weeklyTotals[1].period).toBe('2026-05-08');
    expect(result.weeklyTotals[1].totalAmount).toBe(6000);
    expect(result.weeklyTotals[1].totalQuantity).toBe(15);

    // Weeks with no sales should have zero totals
    expect(result.weeklyTotals[2].totalAmount).toBe(0);
  });

  it('builds 6 monthly periods ending at the requested month', async () => {
    const monthlyData: StreetSale[][] = [
      [makeSale({ amountPix: 1000, amountCash: 500, amountCard: 500, quantity: 5 })], // 2025-12
      [],  // 2026-01
      [],  // 2026-02
      [],  // 2026-03
      [],  // 2026-04
      [makeSale({ amountPix: 2000, amountCash: 1000, amountCard: 500, quantity: 10 })], // 2026-05
    ];

    const repo = makeRepoWithQbs([], monthlyData);
    const service = makeService(repo);

    const result = await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    expect(result.monthlyTotals).toHaveLength(6);
    expect(result.monthlyTotals[0].period).toBe('2025-12');
    expect(result.monthlyTotals[0].totalAmount).toBe(2000);
    expect(result.monthlyTotals[5].period).toBe('2026-05');
    expect(result.monthlyTotals[5].totalAmount).toBe(3500);
    expect(result.monthlyTotals[1].totalAmount).toBe(0); // empty months have zeros
  });

  it('propagates houseId filter to the main query when provided', async () => {
    const mainQb = makeQb([]);
    let mainUsed = false;
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        if (!mainUsed) { mainUsed = true; return mainQb; }
        return makeQb([]);
      }),
    };

    const service = makeService(repo);
    await service.getReport({ type: StreetSaleType.BREAD, month: MONTH, houseId: HOUSE_A });

    expect(mainQb.andWhere).toHaveBeenCalledWith('s.house_id = :houseId', { houseId: HOUSE_A });
  });

  it('does NOT add houseId filter to main query when omitted', async () => {
    const mainQb = makeQb([]);
    let mainUsed = false;
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        if (!mainUsed) { mainUsed = true; return mainQb; }
        return makeQb([]);
      }),
    };

    const service = makeService(repo);
    await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    const houseFilterCalls = mainQb.andWhere.mock.calls.filter(
      (args: unknown[]) => (args[0] as string).includes('house_id'),
    );
    expect(houseFilterCalls).toHaveLength(0);
  });

  it('queries date range covering both current and previous month', async () => {
    const mainQb = makeQb([]);
    let mainUsed = false;
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        if (!mainUsed) { mainUsed = true; return mainQb; }
        return makeQb([]);
      }),
    };

    const service = makeService(repo);
    await service.getReport({ type: StreetSaleType.BREAD, month: MONTH });

    expect(mainQb.andWhere).toHaveBeenCalledWith('s.date >= :start', { start: '2026-04-01' });
    expect(mainQb.andWhere).toHaveBeenCalledWith('s.date < :end', { end: '2026-06-01' });
  });
});

// ─── findOne ─────────────────────────────────────────────────────────────────

describe('StreetSaleService.findOne', () => {
  it('returns view for existing sale', async () => {
    const sale = makeSale();
    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn().mockResolvedValue(sale),
    };
    const service = makeService(repo);
    const result = await service.findOne(SALE_ID);
    expect(result.id).toBe(SALE_ID);
    expect(result.totalAmount).toBe(23000);
  });

  it('throws NotFoundException when sale is not found', async () => {
    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = makeService(repo);
    await expect(service.findOne('no-such-id')).rejects.toThrow('Street sale not found');
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('StreetSaleService.update', () => {
  it('updates fields and returns updated view within 60-minute window', async () => {
    const recentSale = makeSale({ createdAt: new Date(Date.now() - 5 * 60 * 1000) });
    const updatedSale = makeSale({ quantity: 50, createdAt: recentSale.createdAt });

    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn()
        .mockResolvedValueOnce(recentSale)
        .mockResolvedValueOnce(updatedSale),
      save: jest.fn().mockResolvedValue(updatedSale),
    };

    const service = makeService(repo);
    const result = await service.update(SALE_ID, { quantity: 50 });
    expect(repo.save).toHaveBeenCalled();
    expect(result.id).toBe(SALE_ID);
  });

  it('throws NotFoundException when sale does not exist', async () => {
    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = makeService(repo);
    await expect(service.update('no-id', { quantity: 5 })).rejects.toThrow('Street sale not found');
  });

  it('throws ForbiddenException when 60-minute window has expired', async () => {
    const oldSale = makeSale({ createdAt: new Date(Date.now() - 90 * 60 * 1000) });
    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn().mockResolvedValue(oldSale),
    };
    const service = makeService(repo);
    await expect(service.update(SALE_ID, { quantity: 5 })).rejects.toThrow('Edit window of 60 minutes has expired');
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('StreetSaleService.remove', () => {
  it('deletes sale within 60-minute window', async () => {
    const recentSale = makeSale({ createdAt: new Date(Date.now() - 10 * 60 * 1000) });
    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn().mockResolvedValue(recentSale),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = makeService(repo);
    await service.remove(SALE_ID);
    expect(repo.delete).toHaveBeenCalledWith(SALE_ID);
  });

  it('throws NotFoundException when sale does not exist', async () => {
    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = makeService(repo);
    await expect(service.remove('no-id')).rejects.toThrow('Street sale not found');
  });

  it('throws ForbiddenException when 60-minute window has expired', async () => {
    const oldSale = makeSale({ createdAt: new Date(Date.now() - 120 * 60 * 1000) });
    const repo: Partial<Repository<StreetSale>> = {
      findOne: jest.fn().mockResolvedValue(oldSale),
    };
    const service = makeService(repo);
    await expect(service.remove(SALE_ID)).rejects.toThrow('Delete window of 60 minutes has expired');
  });
});

// ─── aggregatePeriod (via getReport) ─────────────────────────────────────────

describe('StreetSaleService — period aggregation', () => {
  it('sums pix, cash, card and quantity correctly across multiple sales', async () => {
    const sales = [
      makeSale({ date: '2026-05-01', amountPix: 1000, amountCash: 2000, amountCard: 500, quantity: 5 }),
      makeSale({ date: '2026-05-01', amountPix: 2000, amountCash: 1000, amountCard: 1500, quantity: 8 }),
    ];

    let mainUsed = false;
    const repo: Partial<Repository<StreetSale>> = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        if (!mainUsed) { mainUsed = true; return makeQb(sales); }
        return makeQb([]);
      }),
    };

    const service = makeService(repo);
    const result = await service.getReport({ type: StreetSaleType.BREAD, month: '2026-05' });

    expect(result.weeklyTotals[0]).toMatchObject({
      period: '2026-05-01',
      totalPix: 3000,
      totalCash: 3000,
      totalCard: 2000,
      totalAmount: 8000,
      totalQuantity: 13,
    });
  });
});
