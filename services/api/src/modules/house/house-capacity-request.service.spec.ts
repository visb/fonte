import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  HouseCapacityRequestStatus,
  NotificationType,
  Role,
} from '@fonte/types';
import { HouseCapacityRequestService } from './house-capacity-request.service';
import { House } from './house.entity';
import { HouseCapacityRequest } from './house-capacity-request.entity';
import { Staff } from '../staff/staff.entity';
import { NotificationService } from '../notification/notification.service';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'req-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
    count: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function makeService(
  repo = makeRepo(),
  houseRepo = makeRepo(),
  staffRepo = makeRepo(),
  notifications: Partial<NotificationService> = { create: jest.fn().mockResolvedValue({}) },
) {
  const service = new HouseCapacityRequestService(
    repo as unknown as Repository<HouseCapacityRequest>,
    houseRepo as unknown as Repository<House>,
    staffRepo as unknown as Repository<Staff>,
    notifications as NotificationService,
  );
  return { service, repo, houseRepo, staffRepo, notifications };
}

const HOUSE = {
  id: 'house-1',
  name: 'Casa Esperança',
  coordinatorId: 'staff-1',
  generalCapacity: 10,
  staffCapacity: 5,
};
const STAFF = { id: 'staff-1', name: 'João', userId: 'user-1' };

describe('HouseCapacityRequestService.createRequest', () => {
  it('snapshots current capacity, supersedes prior pending and notifies ADMIN', async () => {
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(STAFF) });
    const { service, repo, notifications } = makeService(makeRepo(), houseRepo, staffRepo);

    await service.createRequest(
      'house-1',
      { generalCapacity: 12, staffCapacity: 6 },
      'user-1',
    );

    // Supersede o PENDING anterior.
    expect(repo.update).toHaveBeenCalledWith(
      { houseId: 'house-1', status: HouseCapacityRequestStatus.PENDING },
      { status: HouseCapacityRequestStatus.SUPERSEDED },
    );
    // Cria novo PENDING com snapshot.
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        houseId: 'house-1',
        requestedGeneralCapacity: 12,
        requestedStaffCapacity: 6,
        previousGeneralCapacity: 10,
        previousStaffCapacity: 5,
        status: HouseCapacityRequestStatus.PENDING,
        requestedById: 'staff-1',
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.CAPACITY_CHANGE_REQUESTED,
        recipientRole: Role.ADMIN,
        houseId: null,
      }),
    );
  });

  it('rejects when the requester is not the house coordinator', async () => {
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const staffRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'staff-99', name: 'Outro' }),
    });
    const { service } = makeService(makeRepo(), houseRepo, staffRepo);

    await expect(
      service.createRequest('house-1', { generalCapacity: 1, staffCapacity: 1 }, 'user-9'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still resolves when notification emission fails (best-effort)', async () => {
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(STAFF) });
    const notifications = { create: jest.fn().mockRejectedValue(new Error('socket down')) };
    const { service, repo } = makeService(makeRepo(), houseRepo, staffRepo, notifications);

    await expect(
      service.createRequest('house-1', { generalCapacity: 2, staffCapacity: 2 }, 'user-1'),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('HouseCapacityRequestService.createRequest guards', () => {
  it('throws NotFound when the house does not exist', async () => {
    const { NotFoundException } = jest.requireActual('@nestjs/common');
    const { service } = makeService(makeRepo(), makeRepo());
    await expect(
      service.createRequest('nope', { generalCapacity: 1, staffCapacity: 1 }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids when the requester has no staff profile', async () => {
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const { service } = makeService(makeRepo(), houseRepo, staffRepo);
    await expect(
      service.createRequest('house-1', { generalCapacity: 1, staffCapacity: 1 }, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('HouseCapacityRequestService.getById', () => {
  it('returns the request with its requester', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'req-1' }) });
    const { service } = makeService(repo);
    await expect(service.getById('req-1')).resolves.toEqual({ id: 'req-1' });
  });

  it('throws NotFound when the request is missing', async () => {
    const { NotFoundException } = jest.requireActual('@nestjs/common');
    const { service } = makeService(makeRepo());
    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseCapacityRequestService.listForHouse', () => {
  it('lists the history when the house exists', async () => {
    const repo = makeRepo({ find: jest.fn().mockResolvedValue([{ id: 'req-1' }]) });
    const houseRepo = makeRepo({ count: jest.fn().mockResolvedValue(1) });
    const { service } = makeService(repo, houseRepo);
    await expect(service.listForHouse('house-1')).resolves.toEqual([{ id: 'req-1' }]);
  });

  it('throws NotFound when the house does not exist', async () => {
    const { NotFoundException } = jest.requireActual('@nestjs/common');
    const houseRepo = makeRepo({ count: jest.fn().mockResolvedValue(0) });
    const { service } = makeService(makeRepo(), houseRepo);
    await expect(service.listForHouse('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseCapacityRequestService.approve', () => {
  it('applies the capacity to the house and notifies the house', async () => {
    const pending = {
      id: 'req-1',
      houseId: 'house-1',
      requestedGeneralCapacity: 12,
      requestedStaffCapacity: 6,
      status: HouseCapacityRequestStatus.PENDING,
    };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ ...pending }) });
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const { service, notifications } = makeService(repo, houseRepo);

    const result = await service.approve('req-1', 'admin-1');

    expect(houseRepo.update).toHaveBeenCalledWith('house-1', {
      generalCapacity: 12,
      staffCapacity: 6,
    });
    expect(result.status).toBe(HouseCapacityRequestStatus.APPROVED);
    expect(result.reviewedById).toBe('admin-1');
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.CAPACITY_CHANGE_APPROVED,
        houseId: 'house-1',
      }),
    );
  });

  it('throws Conflict when the request is not pending', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'req-1',
        status: HouseCapacityRequestStatus.APPROVED,
      }),
    });
    const { service, houseRepo } = makeService(repo);
    await expect(service.approve('req-1', 'admin-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(houseRepo.update).not.toHaveBeenCalled();
  });
});

describe('HouseCapacityRequestService.reject', () => {
  it('does not change the house capacity and notifies the house', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'req-1',
        houseId: 'house-1',
        requestedGeneralCapacity: 12,
        requestedStaffCapacity: 6,
        status: HouseCapacityRequestStatus.PENDING,
      }),
    });
    const houseRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(HOUSE) });
    const { service, notifications } = makeService(repo, houseRepo);

    const result = await service.reject('req-1', 'admin-1');

    expect(houseRepo.update).not.toHaveBeenCalled();
    expect(result.status).toBe(HouseCapacityRequestStatus.REJECTED);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.CAPACITY_CHANGE_REJECTED,
        houseId: 'house-1',
      }),
    );
  });
});
