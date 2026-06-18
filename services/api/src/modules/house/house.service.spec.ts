import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { HouseService } from './house.service';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { StorageService } from '../storage/storage.service';

function makeHouseRepo(overrides: Record<string, jest.Mock> = {}, queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue([]);
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'house-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(1),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
    manager: { query },
    ...overrides,
  };
}

function makeSimpleRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'x', ...v })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeCache(get?: jest.Mock) {
  return {
    get: get ?? jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService(
  houseRepo: ReturnType<typeof makeHouseRepo>,
  photoRepo = makeSimpleRepo(),
  ruleRepo = makeSimpleRepo(),
  storage: Partial<StorageService> = {},
  cache: ReturnType<typeof makeCache> = makeCache(),
) {
  return new HouseService(
    houseRepo as unknown as Repository<House>,
    photoRepo as unknown as Repository<HousePhoto>,
    ruleRepo as unknown as Repository<HouseRule>,
    storage as StorageService,
    cache as never,
  );
}

describe('HouseService.findAll', () => {
  it('merges resident/staff counts and thumbnails per house', async () => {
    // Cache hit: resident counts come straight from Redis, no GROUP BY query.
    const cache = makeCache(jest.fn().mockResolvedValue({ h1: 3 }));
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ houseId: 'h1', count: '2' }]) // staff
      .mockResolvedValueOnce([{ houseId: 'h1', thumbnailUrl: 'thumb.jpg' }]); // thumbnails
    const houseRepo = makeHouseRepo(
      { find: jest.fn().mockResolvedValue([{ id: 'h1' }, { id: 'h2' }]) },
      query,
    );
    const service = makeService(houseRepo, undefined, undefined, undefined, cache);

    const result = await service.findAll();

    expect(result[0]).toMatchObject({ id: 'h1', activeResidentsCount: 3, staffCount: 2, thumbnailUrl: 'thumb.jpg' });
    // House without rows defaults to zero / null.
    expect(result[1]).toMatchObject({ id: 'h2', activeResidentsCount: 0, staffCount: 0, thumbnailUrl: null });
    // Only staff + thumbnails hit the DB; the resident count was served from cache.
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('computes and caches the resident count map on a cache miss', async () => {
    const cache = makeCache(); // get → null (miss)
    // Dispatch by SQL so the test is order-independent within Promise.all.
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM residents')) return Promise.resolve([{ houseId: 'h1', count: '3' }]);
      return Promise.resolve([]);
    });
    const houseRepo = makeHouseRepo({ find: jest.fn().mockResolvedValue([{ id: 'h1' }]) }, query);
    const service = makeService(houseRepo, undefined, undefined, undefined, cache);

    const result = await service.findAll();

    expect(result[0]).toMatchObject({ id: 'h1', activeResidentsCount: 3 });
    expect(cache.set).toHaveBeenCalledWith('house:resident-counts', { h1: 3 }, expect.any(Number));
  });
});

describe('HouseService.invalidateResidentCounts', () => {
  it('drops the cached resident-count key', async () => {
    const cache = makeCache();
    const service = makeService(makeHouseRepo(), undefined, undefined, undefined, cache);
    await service.invalidateResidentCounts();
    expect(cache.del).toHaveBeenCalledWith('house:resident-counts');
  });
});

describe('HouseService.findOne', () => {
  it('throws NotFound when the house is missing', async () => {
    const houseRepo = makeHouseRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(houseRepo);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the house with counts', async () => {
    // Resident count from cache (h1: 5); only staff hits the DB.
    const cache = makeCache(jest.fn().mockResolvedValue({ h1: 5 }));
    const query = jest.fn().mockResolvedValueOnce([{ count: '4' }]); // staff
    const houseRepo = makeHouseRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'h1', photos: [] }) },
      query,
    );
    const service = makeService(houseRepo, undefined, undefined, undefined, cache);

    const result = await service.findOne('h1');
    expect(result).toMatchObject({ id: 'h1', activeResidentsCount: 5, staffCount: 4 });
  });
});

describe('HouseService.create', () => {
  it('clears other mother houses before saving a new mother house', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
    };
    const houseRepo = makeHouseRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(houseRepo);

    await service.create({ name: 'Mãe', isMotherHouse: true } as never);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(houseRepo.save).toHaveBeenCalled();
  });

  it('does not touch other houses when not a mother house', async () => {
    const houseRepo = makeHouseRepo();
    const service = makeService(houseRepo);

    await service.create({ name: 'Comum', isMotherHouse: false } as never);
    expect(houseRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('HouseService.update', () => {
  it('throws NotFound for an unknown house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.update('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.remove', () => {
  it('soft deletes an existing house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(1) });
    const service = makeService(houseRepo);
    await service.remove('h1');
    expect(houseRepo.softDelete).toHaveBeenCalledWith('h1');
  });

  it('throws NotFound for a missing house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.removePhoto', () => {
  it('deletes the file and the row', async () => {
    const photoRepo = makeSimpleRepo({ findOne: jest.fn().mockResolvedValue({ id: 'p1', url: 'x.jpg' }) });
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = makeService(makeHouseRepo(), photoRepo, makeSimpleRepo(), storage as never);

    await service.removePhoto('h1', 'p1');
    expect(storage.delete).toHaveBeenCalledWith('x.jpg');
    expect(photoRepo.delete).toHaveBeenCalledWith('p1');
  });

  it('throws NotFound for a missing photo', async () => {
    const photoRepo = makeSimpleRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeHouseRepo(), photoRepo);
    await expect(service.removePhoto('h1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.assertHouseExists', () => {
  it('throws NotFound when count is zero', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.assertHouseExists('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
