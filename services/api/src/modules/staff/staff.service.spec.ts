jest.mock('@fonte/types', () => ({
  Role: { ADMIN: 'ADMIN', COORDINATOR: 'COORDINATOR', SERVANT: 'SERVANT' },
  ServantRank: { ASPIRANTE: 'ASPIRANTE', CONSAGRADO: 'CONSAGRADO', ALIANCADO: 'ALIANCADO' },
  StaffPermissionType: { MANAGE_STOREROOM: 'MANAGE_STOREROOM' },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StaffService } from './staff.service';
import { Staff } from './staff.entity';
import { StaffPermission } from './staff-permission.entity';
import { User } from '../user/user.entity';
import { StorageService } from '../storage/storage.service';

interface MockRepo {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  exists: jest.Mock;
  count: jest.Mock;
  delete: jest.Mock;
  softDelete: jest.Mock;
}

function makeRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'staff-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    exists: jest.fn().mockResolvedValue(false),
    count: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(
  staffRepo: MockRepo,
  userRepo: MockRepo,
  permissionRepo: MockRepo,
  storage: Partial<StorageService> = {},
) {
  return new StaffService(
    staffRepo as unknown as Repository<Staff>,
    userRepo as unknown as Repository<User>,
    permissionRepo as unknown as Repository<StaffPermission>,
    storage as StorageService,
  );
}

describe('StaffService.create', () => {
  it('creates user + staff and links userId', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Servo Teste',
      email: 'servo@fonte.com',
      password: 'secret123',
      role: 'SERVANT' as never,
      rank: 'ASPIRANTE' as never,
    } as never);

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    const savedStaff = staffRepo.save.mock.calls[0][0];
    expect(savedStaff.userId).toBe('user-1');
    expect(savedStaff.rank).toBe('ASPIRANTE');
  });

  it('allows a null email (servo without app access)', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Sem Email',
      password: 'secret123',
      role: 'SERVANT' as never,
    } as never);

    // No uniqueness lookup when email is absent.
    expect(userRepo.findOne).not.toHaveBeenCalled();
    expect(userRepo.save.mock.calls[0][0].email).toBeNull();
  });

  it('rejects a duplicate email', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await expect(
      service.create({
        name: 'Dup',
        email: 'dup@fonte.com',
        password: 'secret123',
        role: 'SERVANT' as never,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('nulls rank for non-SERVANT roles', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Coord',
      email: 'coord2@fonte.com',
      password: 'secret123',
      role: 'COORDINATOR' as never,
      rank: 'ASPIRANTE' as never,
    } as never);

    expect(staffRepo.save.mock.calls[0][0].rank).toBeNull();
  });
});

describe('StaffService.createFromResident', () => {
  it('persists a staff carrying the formerResidentId and promotedAt', async () => {
    const staffRepo = makeRepo();
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await service.createFromResident({
      name: 'Promovido',
      phone: null,
      houseId: 'house-1',
      photoUrl: null,
      userId: 'user-9',
      formerResidentId: 'res-9',
      rank: 'ASPIRANTE' as never,
      promotedAt: '2026-06-01',
    });

    const saved = staffRepo.save.mock.calls[0][0];
    expect(saved.formerResidentId).toBe('res-9');
    expect(saved.promotedAt).toBe('2026-06-01');
    expect(saved.userId).toBe('user-9');
  });
});

describe('StaffService.findOne', () => {
  it('throws NotFound when missing', async () => {
    const service = makeService(makeRepo(), makeRepo(), makeRepo());
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the staff when found', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo());
    await expect(service.findOne('staff-1')).resolves.toEqual({ id: 'staff-1' });
  });
});

describe('StaffService.update', () => {
  it('rejects an email already used by another user', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const userRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'user-2' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await expect(service.update('staff-1', { email: 'taken@fonte.com' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows keeping the same email on the same user', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const userRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.update('staff-1', { email: 'same@fonte.com' } as never);
    expect(userRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ email: 'same@fonte.com' }));
  });

  it('clears the email when set to empty', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const userRepo = makeRepo();
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.update('staff-1', { email: '' } as never);
    expect(userRepo.update).toHaveBeenCalledWith('user-1', { email: null });
  });

  it('hashes a new password and forces a change', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const userRepo = makeRepo();
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.update('staff-1', { password: 'newpass123' } as never);
    const patch = userRepo.update.mock.calls[0][1];
    expect(patch.passwordHash).toBe('hashed');
    expect(patch.mustChangePassword).toBe(true);
  });
});

describe('StaffService.uploadPhoto', () => {
  it('deletes the previous photo and stores the new url', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', photoUrl: 'old.jpg' }) });
    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn().mockReturnValue('new.jpg'),
      upload: jest.fn().mockResolvedValue('https://cdn/new.jpg'),
    };
    const service = makeService(staffRepo, makeRepo(), makeRepo(), storage as never);

    await service.uploadPhoto('staff-1', { originalname: 'p.jpg', buffer: Buffer.from(''), mimetype: 'image/jpeg' } as never);

    expect(storage.delete).toHaveBeenCalledWith('old.jpg');
    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { photoUrl: 'https://cdn/new.jpg' });
  });
});

describe('StaffService.remove', () => {
  it('deactivates and soft-deletes both user and staff', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const userRepo = makeRepo();
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.remove('staff-1');

    expect(userRepo.update).toHaveBeenCalledWith('user-1', { isActive: false });
    expect(userRepo.softDelete).toHaveBeenCalledWith('user-1');
    expect(staffRepo.softDelete).toHaveBeenCalledWith('staff-1');
  });
});

describe('StaffService permissions', () => {
  it('rejects adding a permission that already exists', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) });
    const permRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'perm-1' }) });
    const service = makeService(staffRepo, makeRepo(), permRepo);

    await expect(service.addPermission('staff-1', 'MANAGE_STOREROOM' as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NotFound when removing a missing permission', async () => {
    const permRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), makeRepo(), permRepo);

    await expect(service.removePermission('staff-1', 'MANAGE_STOREROOM' as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hasPermission reflects the count', async () => {
    const permRepo = makeRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(makeRepo(), makeRepo(), permRepo);
    await expect(service.hasPermission('staff-1', 'MANAGE_STOREROOM' as never)).resolves.toBe(false);
  });
});
