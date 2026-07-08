jest.mock('@fonte/types', () => ({
  MovementType: {
    IN: 'IN',
    OUT: 'OUT',
  },
}));

import { MovementType } from '@fonte/types';
import { DataSource, Repository } from 'typeorm';
import { StoreroomService } from './storeroom.service';
import { StoreroomItem } from './storeroom.entity';
import { StoreroomMovement } from './storeroom-movement.entity';

describe('StoreroomService', () => {
  let dataSource: { query: jest.Mock };
  let service: StoreroomService;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    service = new StoreroomService(
      {} as Repository<StoreroomItem>,
      {} as Repository<StoreroomMovement>,
      dataSource as unknown as DataSource,
    );
  });

  it('consolidates weekly average usage for the previous 28 days', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    const result = await service.consolidateWeeklyAverageUsage(new Date('2026-05-09T12:00:00Z'));

    expect(result).toEqual({
      skipped: false,
      windowStart: '2026-04-11',
      windowEnd: '2026-05-09',
      updatedItems: 2,
    });
    expect(dataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('weekly_average_usage = ROUND((usage.total_quantity / $4)::numeric, 3)'),
      [MovementType.OUT, '2026-04-11', '2026-05-09', 4],
    );
    expect(dataSource.query.mock.calls[1][0]).toContain('FROM inventory_items i');
    expect(dataSource.query.mock.calls[1][0]).toContain('LEFT JOIN inventory_movements m');
    expect(dataSource.query.mock.calls[1][0]).toContain('AND m.type = $1');
    expect(dataSource.query.mock.calls[1][0]).toContain('AND m.date >= $2');
    expect(dataSource.query.mock.calls[1][0]).toContain('AND m.date < $3');
    expect(dataSource.query.mock.calls[1][0]).toContain('WHERE i.deleted_at IS NULL');
    // scheduler consolida somente itens de almoxarifado (kind = STOREROOM)
    expect(dataSource.query.mock.calls[1][0]).toContain("i.kind = 'STOREROOM'");
  });

  it('skips consolidation when advisory lock is not acquired', async () => {
    dataSource.query.mockResolvedValueOnce([{ acquired: false }]);

    const result = await service.consolidateWeeklyAverageUsage(new Date('2026-05-09T12:00:00Z'));

    expect(result).toEqual({
      skipped: true,
      windowStart: '2026-04-11',
      windowEnd: '2026-05-09',
      updatedItems: 0,
    });
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('releases advisory lock when consolidation fails', async () => {
    const error = new Error('database failed');
    dataSource.query
      .mockResolvedValueOnce([{ acquired: true }])
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    await expect(service.consolidateWeeklyAverageUsage(new Date('2026-05-09T12:00:00Z'))).rejects.toThrow(error);

    expect(dataSource.query).toHaveBeenNthCalledWith(
      3,
      `SELECT pg_advisory_unlock(hashtext($1))`,
      ['storeroom_weekly_average_usage'],
    );
  });
});

// ── Items CRUD + stock movement rules (story 50: gap fill) ────────────────────

import { BadRequestException, NotFoundException } from '@nestjs/common';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'item-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function makeCrudService(
  itemRepo: ReturnType<typeof makeRepo>,
  movementRepo = makeRepo(),
) {
  return new StoreroomService(
    itemRepo as unknown as Repository<StoreroomItem>,
    movementRepo as unknown as Repository<StoreroomMovement>,
    { query: jest.fn() } as unknown as DataSource,
  );
}

describe('StoreroomService.findItems', () => {
  it('scopes by house when given', async () => {
    const itemRepo = makeRepo();
    const service = makeCrudService(itemRepo);
    await service.findItems('house-1');
    expect(itemRepo.find.mock.calls[0][0].where).toEqual({ houseId: 'house-1' });
  });

  it('lists everything when no house is given', async () => {
    const itemRepo = makeRepo();
    const service = makeCrudService(itemRepo);
    await service.findItems();
    expect(itemRepo.find.mock.calls[0][0].where).toEqual({});
  });
});

describe('StoreroomService.findItem', () => {
  it('throws NotFound when the item is missing', async () => {
    const service = makeCrudService(makeRepo());
    await expect(service.findItem('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the item when found', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    const service = makeCrudService(itemRepo);
    await expect(service.findItem('item-1')).resolves.toEqual({ id: 'item-1' });
  });
});

describe('StoreroomService.updateItem', () => {
  it('throws NotFound before updating a missing item', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeCrudService(itemRepo);
    await expect(service.updateItem('nope', { name: 'X' } as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(itemRepo.update).not.toHaveBeenCalled();
  });

  it('updates and returns the fresh item', async () => {
    const itemRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'item-1', name: 'Old' })
        .mockResolvedValueOnce({ id: 'item-1', name: 'New' }),
    });
    const service = makeCrudService(itemRepo);
    const result = await service.updateItem('item-1', { name: 'New' } as never);
    expect(itemRepo.update).toHaveBeenCalledWith('item-1', { name: 'New' });
    expect(result).toEqual({ id: 'item-1', name: 'New' });
  });
});

describe('StoreroomService.removeItem', () => {
  it('throws NotFound for a missing item', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeCrudService(itemRepo);
    await expect(service.removeItem('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(itemRepo.softDelete).not.toHaveBeenCalled();
  });

  it('soft-deletes the item', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    const service = makeCrudService(itemRepo);
    await service.removeItem('item-1');
    expect(itemRepo.softDelete).toHaveBeenCalledWith('item-1');
  });
});

describe('StoreroomService.createItem', () => {
  it('persists a new item', async () => {
    const itemRepo = makeRepo();
    const service = makeCrudService(itemRepo);
    await service.createItem({ name: 'Sabão', category: 'Limpeza' } as never);
    expect(itemRepo.create).toHaveBeenCalledWith({ name: 'Sabão', category: 'Limpeza' });
    expect(itemRepo.save).toHaveBeenCalled();
  });
});

describe('StoreroomService.findMovements', () => {
  function makeQb() {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['leftJoinAndSelect', 'orderBy', 'addOrderBy', 'andWhere']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getMany = jest.fn().mockResolvedValue([{ id: 'mov-1' }]);
    return qb;
  }

  it('filters by item and house when both are provided', async () => {
    const qb = makeQb();
    const movementRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeCrudService(makeRepo(), movementRepo);
    await expect(service.findMovements('house-1', 'item-1')).resolves.toEqual([{ id: 'mov-1' }]);
    expect(qb.andWhere).toHaveBeenCalledWith('m.item_id = :itemId', { itemId: 'item-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('item.house_id = :houseId', { houseId: 'house-1' });
  });

  it('applies no filters when neither is provided', async () => {
    const qb = makeQb();
    const movementRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeCrudService(makeRepo(), movementRepo);
    await service.findMovements();
    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('StoreroomService.createMovement', () => {
  it('increments the stock on an IN movement', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', currentQuantity: 10 }) });
    const movementRepo = makeRepo();
    const service = makeCrudService(itemRepo, movementRepo);

    await service.createMovement({ itemId: 'item-1', type: MovementType.IN, quantity: 5 } as never);

    expect(itemRepo.update).toHaveBeenCalledWith('item-1', { currentQuantity: 15 });
    expect(movementRepo.save).toHaveBeenCalled();
  });

  it('decrements the stock on an OUT movement', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', currentQuantity: 10 }) });
    const service = makeCrudService(itemRepo);

    await service.createMovement({ itemId: 'item-1', type: MovementType.OUT, quantity: 4 } as never);

    expect(itemRepo.update).toHaveBeenCalledWith('item-1', { currentQuantity: 6 });
  });

  it('rejects an OUT movement that would drive the stock negative (no estorno)', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', currentQuantity: 2 }) });
    const movementRepo = makeRepo();
    const service = makeCrudService(itemRepo, movementRepo);

    await expect(
      service.createMovement({ itemId: 'item-1', type: MovementType.OUT, quantity: 5 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(itemRepo.update).not.toHaveBeenCalled();
    expect(movementRepo.save).not.toHaveBeenCalled();
  });

  it('throws NotFound when the target item does not exist', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeCrudService(itemRepo);
    await expect(
      service.createMovement({ itemId: 'nope', type: MovementType.IN, quantity: 1 } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
