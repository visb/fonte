import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MovementType } from '@fonte/types';
import { SupplyRoomService } from './supply-room.service';
import { SupplyRoomItem } from './supply-room-item.entity';
import { SupplyRoomMovement } from './supply-room-movement.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'x', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function makeService(itemRepo: ReturnType<typeof makeRepo>, movementRepo = makeRepo()) {
  return new SupplyRoomService(
    itemRepo as unknown as Repository<SupplyRoomItem>,
    movementRepo as unknown as Repository<SupplyRoomMovement>,
  );
}

describe('SupplyRoomService.findItem', () => {
  it('throws NotFound when missing', async () => {
    const service = makeService(makeRepo());
    await expect(service.findItem('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SupplyRoomService.findItems', () => {
  it('scopes by house when given', async () => {
    const itemRepo = makeRepo();
    const service = makeService(itemRepo);
    await service.findItems('house-1');
    expect(itemRepo.find.mock.calls[0][0].where).toEqual({ houseId: 'house-1' });
  });

  it('lists all items when no house is given', async () => {
    const itemRepo = makeRepo();
    const service = makeService(itemRepo);
    await service.findItems();
    expect(itemRepo.find.mock.calls[0][0].where).toEqual({});
  });
});

describe('SupplyRoomService item CRUD', () => {
  it('creates an item', async () => {
    const itemRepo = makeRepo();
    const service = makeService(itemRepo);
    await service.createItem({ name: 'Arroz', category: 'Alimento' } as never);
    expect(itemRepo.create).toHaveBeenCalledWith({ name: 'Arroz', category: 'Alimento' });
    expect(itemRepo.save).toHaveBeenCalled();
  });

  it('updates an existing item', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    const service = makeService(itemRepo);
    await service.updateItem('item-1', { name: 'Feijão' } as never);
    expect(itemRepo.update).toHaveBeenCalledWith('item-1', { name: 'Feijão' });
  });

  it('soft-deletes an existing item', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    const service = makeService(itemRepo);
    await service.removeItem('item-1');
    expect(itemRepo.softDelete).toHaveBeenCalledWith('item-1');
  });
});

describe('SupplyRoomService.findMovements', () => {
  function makeQb() {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['leftJoinAndSelect', 'orderBy', 'addOrderBy', 'andWhere']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getMany = jest.fn().mockResolvedValue([{ id: 'mov-1' }]);
    return qb;
  }

  it('filters by item and house when both are given', async () => {
    const qb = makeQb();
    const movementRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(makeRepo(), movementRepo);

    await expect(service.findMovements('house-1', 'item-1')).resolves.toEqual([{ id: 'mov-1' }]);
    expect(qb.andWhere).toHaveBeenCalledWith('m.item_id = :itemId', { itemId: 'item-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('item.house_id = :houseId', { houseId: 'house-1' });
  });

  it('applies no filters when neither is given', async () => {
    const qb = makeQb();
    const movementRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(makeRepo(), movementRepo);

    await service.findMovements();
    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('SupplyRoomService.createMovement', () => {
  it('increments the stock on an IN movement', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', currentQuantity: 10 }) });
    const movementRepo = makeRepo();
    const service = makeService(itemRepo, movementRepo);

    await service.createMovement({ itemId: 'item-1', type: MovementType.IN, quantity: 5 } as never);

    expect(itemRepo.update).toHaveBeenCalledWith('item-1', { currentQuantity: 15 });
    expect(movementRepo.save).toHaveBeenCalled();
  });

  it('decrements the stock on an OUT movement', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', currentQuantity: 10 }) });
    const service = makeService(itemRepo);

    await service.createMovement({ itemId: 'item-1', type: MovementType.OUT, quantity: 4 } as never);

    expect(itemRepo.update).toHaveBeenCalledWith('item-1', { currentQuantity: 6 });
  });

  it('rejects an OUT movement that would go negative', async () => {
    const itemRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', currentQuantity: 2 }) });
    const service = makeService(itemRepo);

    await expect(
      service.createMovement({ itemId: 'item-1', type: MovementType.OUT, quantity: 5 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(itemRepo.update).not.toHaveBeenCalled();
  });
});
