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

function makeEmitter() {
  return { emit: jest.fn() };
}

function makeService(
  staffRepo: MockRepo,
  userRepo: MockRepo,
  permissionRepo: MockRepo,
  storage: Partial<StorageService> = {},
  emitter: ReturnType<typeof makeEmitter> = makeEmitter(),
) {
  return new StaffService(
    staffRepo as unknown as Repository<Staff>,
    userRepo as unknown as Repository<User>,
    permissionRepo as unknown as Repository<StaffPermission>,
    storage as StorageService,
    emitter as never,
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

  // Story 96 — campos clínicos/de tratamento foram removidos do Staff. O service
  // só persiste o que vem no DTO; como o DTO não os expõe mais, nunca chegam à
  // entidade salva.
  it('does not persist removed treatment fields', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Servo Limpo',
      password: 'secret123',
      role: 'SERVANT' as never,
      cpf: '12345678901',
      occupation: 'Auxiliar',
    } as never);

    const savedStaff = staffRepo.save.mock.calls[0][0];
    expect(savedStaff.cpf).toBe('12345678901');
    expect(savedStaff).not.toHaveProperty('addiction');
    expect(savedStaff).not.toHaveProperty('healthIssues');
    expect(savedStaff).not.toHaveProperty('continuousMedication');
    expect(savedStaff).not.toHaveProperty('weight');
    expect(savedStaff).not.toHaveProperty('height');
  });

  // Story 97 — o whatsapp é o identificador de login: persistido só com dígitos,
  // coerente com a normalização do lookup no login.
  it('normalizes the whatsapp to digits on create', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Servo Zap',
      password: 'secret123',
      role: 'SERVANT' as never,
      whatsapp: '(11) 97777-0001',
    } as never);

    expect(staffRepo.save.mock.calls[0][0].whatsapp).toBe('11977770001');
  });

  it('stores null when the whatsapp has no digits', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Servo Sem Zap',
      password: 'secret123',
      role: 'SERVANT' as never,
      whatsapp: ' - ',
    } as never);

    expect(staffRepo.save.mock.calls[0][0].whatsapp).toBeNull();
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
      whatsapp: null,
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

  // Story 97 — o contato do filho promovido vira o whatsapp do servo, normalizado.
  it('normalizes the promoted resident contact into the staff whatsapp', async () => {
    const staffRepo = makeRepo();
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await service.createFromResident({
      name: 'Promovido Zap',
      whatsapp: '(62) 98888-0000',
      houseId: null,
      photoUrl: null,
      userId: 'user-9',
      formerResidentId: 'res-9',
      rank: 'ASPIRANTE' as never,
      promotedAt: '2026-06-01',
    });

    expect(staffRepo.save.mock.calls[0][0].whatsapp).toBe('62988880000');
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

  // Story 97 — whatsapp também é normalizado para dígitos no update.
  it('normalizes the whatsapp to digits on update', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await service.update('staff-1', { whatsapp: '(11) 97777-0002' } as never);

    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { whatsapp: '11977770002' });
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

describe('StaffService.uploadSignature (story 128)', () => {
  it('stores the CANONICAL url in signature_url and deletes the previous file', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', signatureUrl: 'old.png' }) });
    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn().mockReturnValue('sig.png'),
      upload: jest.fn().mockResolvedValue('https://cdn/signatures/sig.png'),
    };
    const service = makeService(staffRepo, makeRepo(), makeRepo(), storage as never);

    await service.uploadSignature('staff-1', { originalname: 's.png', buffer: Buffer.from(''), mimetype: 'image/png' } as never);

    expect(storage.delete).toHaveBeenCalledWith('old.png');
    expect(storage.upload).toHaveBeenCalledWith('signatures', 'sig.png', expect.any(Buffer), 'image/png');
    // URL canônica (sem query de assinatura) — a assinatura de acesso é aplicada na leitura.
    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { signatureUrl: 'https://cdn/signatures/sig.png' });
  });

  it('does not delete when there is no previous signature', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', signatureUrl: null }) });
    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn().mockReturnValue('sig.png'),
      upload: jest.fn().mockResolvedValue('https://cdn/signatures/sig.png'),
    };
    const service = makeService(staffRepo, makeRepo(), makeRepo(), storage as never);

    await service.uploadSignature('staff-1', { originalname: 's.png', buffer: Buffer.from(''), mimetype: 'image/png' } as never);

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('uploadSignatureMe resolves the staff by userId then uploads', async () => {
    const staffRepo = makeRepo({
      findOne: jest
        .fn()
        // findByUserId lookup (relations user/house)
        .mockResolvedValueOnce({ id: 'staff-1', userId: 'user-1', signatureUrl: null })
        // findOne(id) inside uploadSignature
        .mockResolvedValue({ id: 'staff-1', signatureUrl: null }),
    });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const storage = {
      delete: jest.fn(),
      uniqueFilename: jest.fn().mockReturnValue('sig.png'),
      upload: jest.fn().mockResolvedValue('https://cdn/signatures/sig.png'),
    };
    const service = makeService(staffRepo, makeRepo(), permRepo, storage as never);

    await service.uploadSignatureMe('user-1', { originalname: 's.png', buffer: Buffer.from(''), mimetype: 'image/png' } as never);

    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { signatureUrl: 'https://cdn/signatures/sig.png' });
  });
});

describe('StaffService.removeSignature (story 138)', () => {
  it('deletes the file and clears signature_url when a signature exists', async () => {
    const staffRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'staff-1', signatureUrl: 'sig.png' })
        .mockResolvedValue({ id: 'staff-1', signatureUrl: null }),
    });
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = makeService(staffRepo, makeRepo(), makeRepo(), storage as never);

    const result = await service.removeSignature('staff-1');

    expect(storage.delete).toHaveBeenCalledWith('sig.png');
    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { signatureUrl: null });
    expect(result).toEqual({ id: 'staff-1', signatureUrl: null });
  });

  it('is idempotent: no delete and no update when there is no signature', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', signatureUrl: null }) });
    const storage = { delete: jest.fn() };
    const service = makeService(staffRepo, makeRepo(), makeRepo(), storage as never);

    const result = await service.removeSignature('staff-1');

    expect(storage.delete).not.toHaveBeenCalled();
    expect(staffRepo.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'staff-1', signatureUrl: null });
  });

  it('removeSignatureMe resolves the staff by userId then removes', async () => {
    const staffRepo = makeRepo({
      findOne: jest
        .fn()
        // findByUserId lookup (relations user/house)
        .mockResolvedValueOnce({ id: 'staff-1', userId: 'user-1', signatureUrl: 'sig.png' })
        // findOne(id) inside removeSignature (before) and after update
        .mockResolvedValueOnce({ id: 'staff-1', signatureUrl: 'sig.png' })
        .mockResolvedValue({ id: 'staff-1', signatureUrl: null }),
    });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = makeService(staffRepo, makeRepo(), permRepo, storage as never);

    await service.removeSignatureMe('user-1');

    expect(storage.delete).toHaveBeenCalledWith('sig.png');
    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { signatureUrl: null });
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

describe('StaffService house:list cache invalidation', () => {
  const HOUSE_STAFF_CHANGED_EVENT = 'house.staff.changed';

  it('emits HOUSE_STAFF_CHANGED_EVENT on create', async () => {
    const emitter = makeEmitter();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(makeRepo(), userRepo, makeRepo(), {}, emitter);

    await service.create({
      name: 'Servo',
      email: 'servo3@fonte.com',
      password: 'secret123',
      role: 'SERVANT' as never,
    } as never);

    expect(emitter.emit).toHaveBeenCalledWith(HOUSE_STAFF_CHANGED_EVENT);
  });

  it('emits HOUSE_STAFF_CHANGED_EVENT on update', async () => {
    const emitter = makeEmitter();
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo(), {}, emitter);

    await service.update('staff-1', { houseId: 'house-2' } as never);

    expect(emitter.emit).toHaveBeenCalledWith(HOUSE_STAFF_CHANGED_EVENT);
  });

  it('emits HOUSE_STAFF_CHANGED_EVENT on remove', async () => {
    const emitter = makeEmitter();
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo(), {}, emitter);

    await service.remove('staff-1');

    expect(emitter.emit).toHaveBeenCalledWith(HOUSE_STAFF_CHANGED_EVENT);
  });

  it('does not emit on updateMe (own profile, no house/lotação change)', async () => {
    const emitter = makeEmitter();
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo(), {}, emitter);

    await service.updateMe('user-1', { whatsapp: '11999' } as never);

    expect(emitter.emit).not.toHaveBeenCalled();
  });
});

describe('StaffService.findAll house scoping', () => {
  it('ADMIN lists all staff (no house filter)', async () => {
    const staffRepo = makeRepo({ find: jest.fn().mockResolvedValue([{ id: 's1' }]) });
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await service.findAll({ role: 'ADMIN', userId: 'u1' });

    expect(staffRepo.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ where: expect.anything() }),
    );
  });

  it('COORDINATOR is scoped to own house', async () => {
    const staffRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'me', userId: 'u1', houseId: 'house-9' }),
      find: jest.fn().mockResolvedValue([]),
    });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const service = makeService(staffRepo, makeRepo(), permRepo);

    await service.findAll({ role: 'COORDINATOR', userId: 'u1' });

    expect(staffRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { houseId: 'house-9' } }),
    );
  });

  it('returns empty when non-admin caller has no house', async () => {
    const staffRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'me', userId: 'u1', houseId: null }),
      find: jest.fn().mockResolvedValue([]),
    });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const service = makeService(staffRepo, makeRepo(), permRepo);

    const result = await service.findAll({ role: 'SERVANT', userId: 'u1' });

    expect(result).toEqual([]);
    expect(staffRepo.find).not.toHaveBeenCalled();
  });
});
