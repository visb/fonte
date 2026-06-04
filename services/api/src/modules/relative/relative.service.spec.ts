jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RelativeService } from './relative.service';
import { Relative } from './relative.entity';
import { Resident } from '../resident/resident.entity';
import { User } from '../user/user.entity';
import { StorageService } from '../storage/storage.service';
import { ResidentFollowUpService } from '../resident-follow-up/resident-follow-up.service';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'rel-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(1),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(
  relativeRepo: ReturnType<typeof makeRepo>,
  userRepo = makeRepo(),
  followUp: Partial<ResidentFollowUpService> = { createAuto: jest.fn() },
) {
  return new RelativeService(
    relativeRepo as unknown as Repository<Relative>,
    makeRepo() as unknown as Repository<Resident>,
    userRepo as unknown as Repository<User>,
    {} as StorageService,
    followUp as ResidentFollowUpService,
  );
}

describe('RelativeService.create', () => {
  it('logs a RELATIVE_ADDED follow-up and marks responsible when requested', async () => {
    const relativeRepo = makeRepo({
      save: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }),
    });
    const createAuto = jest.fn();
    const service = makeService(relativeRepo, makeRepo(), { createAuto });

    await service.create({ residentId: 'res-1', name: 'Mãe', isResponsible: true } as never);

    expect(createAuto).toHaveBeenCalledWith('res-1', 'RELATIVE_ADDED');
    // setResponsible clears the others then marks this one.
    expect(relativeRepo.update).toHaveBeenCalled();
  });
});

describe('RelativeService.setResponsible', () => {
  it('throws NotFound for a missing relative', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.setResponsible('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('clears other responsibles before marking this one', async () => {
    const relativeRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }),
    });
    const service = makeService(relativeRepo);

    await service.setResponsible('rel-1');

    expect(relativeRepo.update).toHaveBeenNthCalledWith(1, { residentId: 'res-1' }, { isResponsible: false });
    expect(relativeRepo.update).toHaveBeenNthCalledWith(2, 'rel-1', { isResponsible: true });
  });
});

describe('RelativeService.remove', () => {
  it('throws NotFound when the relative does not exist', async () => {
    const service = makeService(makeRepo({ count: jest.fn().mockResolvedValue(0) }));
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RelativeService.generateAccess', () => {
  it('rejects when access already exists', async () => {
    const relativeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', userId: 'user-1' }) });
    const service = makeService(relativeRepo);
    await expect(service.generateAccess('rel-1', 'a@b.com', 'secret123')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a duplicate email', async () => {
    const relativeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', userId: null }) });
    const userRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService(relativeRepo, userRepo);
    await expect(service.generateAccess('rel-1', 'taken@b.com', 'secret123')).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a RELATIVE user and links it', async () => {
    const relativeRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rel-1', userId: null })
        .mockResolvedValue({ id: 'rel-1', userId: 'user-9' }),
    });
    const userRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({ id: 'user-9' }),
    });
    const service = makeService(relativeRepo, userRepo);

    await service.generateAccess('rel-1', 'new@b.com', 'secret123');

    expect(userRepo.create.mock.calls[0][0].role).toBe('RELATIVE');
    expect(relativeRepo.update).toHaveBeenCalledWith('rel-1', { userId: 'user-9' });
  });
});

describe('RelativeService.resetPassword', () => {
  it('throws NotFound when no access was generated', async () => {
    const relativeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', userId: null, user: null }) });
    const service = makeService(relativeRepo);
    await expect(service.resetPassword('rel-1', 'secret123')).rejects.toBeInstanceOf(NotFoundException);
  });
});
