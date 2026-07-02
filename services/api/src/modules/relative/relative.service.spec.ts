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
    makeRepo() as never, // Staff repo
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

function buildWithStorage(
  relativeRepo: ReturnType<typeof makeRepo>,
  storage: Partial<StorageService> = {},
) {
  return new RelativeService(
    relativeRepo as unknown as Repository<Relative>,
    makeRepo() as unknown as Repository<Resident>,
    makeRepo() as never,
    makeRepo() as unknown as Repository<User>,
    storage as StorageService,
    { createAuto: jest.fn() } as unknown as ResidentFollowUpService,
  );
}

const meRow = {
  id: 'rel-1',
  userId: 'user-1',
  name: 'Mãe',
  phone: '999',
  photoUrl: null,
  relationship: 'MOTHER',
  resident: {
    id: 'res-1',
    name: 'João',
    photoUrl: 'res.jpg',
    house: {
      id: 'h1',
      name: 'Casa 1',
      address: 'Rua 1',
      city: 'Goiânia',
      phone: '111',
      // Staff.phone virou whatsapp (story 97); a view mantém coordinatorPhone.
      coordinator: { name: 'Coord', whatsapp: '222' },
    },
  },
};

describe('RelativeService.findMe', () => {
  it('throws NotFound when there is no relative profile', async () => {
    const service = buildWithStorage(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.findMe('user-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps the relative + resident + house + coordinator into the view', async () => {
    const service = buildWithStorage(
      makeRepo({ findOne: jest.fn().mockResolvedValue(meRow) }),
    );
    const view = await service.findMe('user-1');
    expect(view).toMatchObject({
      residentId: 'res-1',
      residentName: 'João',
      houseName: 'Casa 1',
      coordinatorName: 'Coord',
      coordinatorPhone: '222',
    });
  });
});

describe('RelativeService.updateMe', () => {
  it('throws NotFound for a missing profile', async () => {
    const service = buildWithStorage(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.updateMe('user-x', {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates then returns the refreshed view', async () => {
    const relativeRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rel-1', userId: 'user-1' })
        .mockResolvedValue(meRow),
    });
    const service = buildWithStorage(relativeRepo);
    await service.updateMe('user-1', { phone: '000' } as never);
    expect(relativeRepo.update).toHaveBeenCalledWith('rel-1', { phone: '000' });
  });
});

describe('RelativeService.uploadPhoto', () => {
  const file = {
    originalname: 'p.jpg',
    buffer: Buffer.from('x'),
    mimetype: 'image/jpeg',
  } as Express.Multer.File;

  it('throws NotFound for a missing profile', async () => {
    const service = buildWithStorage(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.uploadPhoto('user-x', file)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the previous photo and stores the new one', async () => {
    const relativeRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rel-1', userId: 'user-1', photoUrl: 'old.jpg' })
        .mockResolvedValue(meRow),
    });
    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn().mockReturnValue('new.jpg'),
      upload: jest.fn().mockResolvedValue('relatives/new.jpg'),
    };
    const service = buildWithStorage(relativeRepo, storage);
    await service.uploadPhoto('user-1', file);
    expect(storage.delete).toHaveBeenCalledWith('old.jpg');
    expect(relativeRepo.update).toHaveBeenCalledWith('rel-1', { photoUrl: 'relatives/new.jpg' });
  });

  it('skips deletion when there is no previous photo', async () => {
    const relativeRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rel-1', userId: 'user-1', photoUrl: null })
        .mockResolvedValue(meRow),
    });
    const storage = {
      delete: jest.fn(),
      uniqueFilename: jest.fn().mockReturnValue('new.jpg'),
      upload: jest.fn().mockResolvedValue('relatives/new.jpg'),
    };
    const service = buildWithStorage(relativeRepo, storage);
    await service.uploadPhoto('user-1', file);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe('RelativeService.remove (success) and resetPassword (success)', () => {
  it('soft-deletes an existing relative', async () => {
    const relativeRepo = makeRepo({ count: jest.fn().mockResolvedValue(1) });
    const service = buildWithStorage(relativeRepo);
    await service.remove('rel-1');
    expect(relativeRepo.softDelete).toHaveBeenCalledWith('rel-1');
  });

  it('resets the password for a relative with access', async () => {
    const relativeRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'rel-1', userId: 'user-1', user: { id: 'user-1' } }),
    });
    const userRepo = makeRepo();
    const service = makeService(relativeRepo, userRepo);
    await service.resetPassword('rel-1', 'newsecret');
    expect(userRepo.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ mustChangePassword: true }),
    );
  });
});

describe('RelativeService.findByResident house scoping', () => {
  function build(staffFindOne: jest.Mock, residentFindOne: jest.Mock, relFind: jest.Mock) {
    return new RelativeService(
      { find: relFind } as never,                 // relativeRepository
      { findOne: residentFindOne } as never,      // residentRepository
      { findOne: staffFindOne } as never,         // staffRepository
      {} as never,                                // userRepository
      {} as never,                                // storageService
      {} as never,                                // followUpService
    );
  }

  it('ADMIN bypasses house scoping', async () => {
    const relFind = jest.fn().mockResolvedValue([{ id: 'rel-1' }]);
    const service = build(jest.fn(), jest.fn(), relFind);
    await expect(service.findByResident('res-1', { role: 'ADMIN', userId: 'u1' })).resolves.toHaveLength(1);
    expect(relFind).toHaveBeenCalled();
  });

  it('SERVANT in same house is allowed', async () => {
    const relFind = jest.fn().mockResolvedValue([{ id: 'rel-1' }]);
    const service = build(
      jest.fn().mockResolvedValue({ houseId: 'house-9' }),
      jest.fn().mockResolvedValue({ id: 'res-1', houseId: 'house-9' }),
      relFind,
    );
    await expect(service.findByResident('res-1', { role: 'SERVANT', userId: 'u1' })).resolves.toHaveLength(1);
  });

  it('SERVANT from another house is forbidden', async () => {
    const { ForbiddenException } = jest.requireActual('@nestjs/common');
    const service = build(
      jest.fn().mockResolvedValue({ houseId: 'house-A' }),
      jest.fn().mockResolvedValue({ id: 'res-1', houseId: 'house-B' }),
      jest.fn(),
    );
    await expect(service.findByResident('res-1', { role: 'SERVANT', userId: 'u1' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
