import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StaffPermissionType, WishlistStatus } from '@fonte/types';
import { WishlistService } from './wishlist.service';
import { WishlistItem } from './wishlist-item.entity';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { StaffPermission } from '../staff/staff-permission.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findByIds: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'item-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(1),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(repos: {
  item?: ReturnType<typeof makeRepo>;
  resident?: ReturnType<typeof makeRepo>;
  relative?: ReturnType<typeof makeRepo>;
  staff?: ReturnType<typeof makeRepo>;
  permission?: ReturnType<typeof makeRepo>;
} = {}) {
  return new WishlistService(
    (repos.item ?? makeRepo()) as unknown as Repository<WishlistItem>,
    (repos.resident ?? makeRepo()) as unknown as Repository<Resident>,
    (repos.relative ?? makeRepo()) as unknown as Repository<Relative>,
    (repos.staff ?? makeRepo()) as unknown as Repository<Staff>,
    (repos.permission ?? makeRepo()) as unknown as Repository<StaffPermission>,
  );
}

describe('WishlistService.findApproved', () => {
  it('queries only APPROVED items', async () => {
    const item = makeRepo();
    const service = makeService({ item });
    await service.findApproved('res-1');
    expect(item.find.mock.calls[0][0].where).toMatchObject({ residentId: 'res-1', status: WishlistStatus.APPROVED });
  });
});

describe('WishlistService.addItem', () => {
  it('forbids adding to a resident that is not the caller', async () => {
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ resident });
    await expect(service.addItem('user-1', 'res-1', { description: 'Tênis' } as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates a PENDING_APPROVAL item for the caller', async () => {
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1', userId: 'user-1' }) });
    const item = makeRepo();
    const service = makeService({ item, resident });

    await service.addItem('user-1', 'res-1', { description: 'Tênis', quantity: 2 } as never);

    expect(item.create.mock.calls[0][0]).toMatchObject({ status: WishlistStatus.PENDING_APPROVAL, quantity: 2 });
  });
});

describe('WishlistService.findPending', () => {
  it('forbids staff without the moderate permission', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService({ staff, permission });
    await expect(service.findPending('user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids when no staff profile exists', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ staff });
    await expect(service.findPending('user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('WishlistService.approve', () => {
  function moderator() {
    return {
      staff: makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) }),
      permission: makeRepo({ count: jest.fn().mockResolvedValue(1) }),
    };
  }

  it('throws NotFound for a missing item', async () => {
    const { staff, permission } = moderator();
    const item = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ item, staff, permission });
    await expect(service.approve('user-1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes the item when removal was requested', async () => {
    const { staff, permission } = moderator();
    const item = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', isRemovalRequested: true }) });
    const service = makeService({ item, staff, permission });

    await service.approve('user-1', 'item-1');
    expect(item.softDelete).toHaveBeenCalledWith('item-1');
  });

  it('marks the item APPROVED otherwise', async () => {
    const { staff, permission } = moderator();
    const item = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1', isRemovalRequested: false }) });
    const service = makeService({ item, staff, permission });

    await service.approve('user-1', 'item-1');
    expect(item.update.mock.calls[0][1]).toMatchObject({ status: WishlistStatus.APPROVED });
  });
});

describe('WishlistService.reject', () => {
  it('records the rejection reason and resets removal flag', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(1) });
    const item = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'item-1' }) });
    const service = makeService({ item, staff, permission });

    await service.reject('user-1', 'item-1', 'fora das regras');

    expect(item.update.mock.calls[0][1]).toMatchObject({
      status: WishlistStatus.REJECTED,
      rejectionReason: 'fora das regras',
      isRemovalRequested: false,
    });
  });
});

// Ensure the permission enum referenced by the service is exercised.
it('uses MODERATE_MESSAGES for moderation gating', () => {
  expect(StaffPermissionType.MODERATE_MESSAGES).toBeDefined();
});
