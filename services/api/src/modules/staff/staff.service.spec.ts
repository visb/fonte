jest.mock('@fonte/types', () => ({
  // Story 202: os helpers de maioridade (`isAdultBirthDate`, `MIN_AGE_MESSAGE`…)
  // precisam ser os reais; os enums abaixo seguem stubados.
  ...jest.requireActual('@fonte/types'),
  Role: { ADMIN: 'ADMIN', COORDINATOR: 'COORDINATOR', SERVANT: 'SERVANT' },
  ServantRank: { ASPIRANTE: 'ASPIRANTE', CONSAGRADO: 'CONSAGRADO', ALIANCADO: 'ALIANCADO' },
  StaffPermissionType: { MANAGE_STOREROOM: 'MANAGE_STOREROOM' },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { maxBirthDateFor, MIN_AGE_MESSAGE, todayInSaoPaulo } from '@fonte/types';
import { Repository } from 'typeorm';
import { StaffService } from './staff.service';
import { Staff } from './staff.entity';
import { House } from '../house/house.entity';
import { StaffPermission } from './staff-permission.entity';
import { StaffServicePeriod } from './staff-service-period.entity';
import { User } from '../user/user.entity';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { AuditLog } from '../audit/audit-log.entity';

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
  manager?: { transaction: jest.Mock };
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

/**
 * EntityManager transacional (story 194). As transições que tiram o staff da
 * lista de coordenadores da casa escrevem staff, user e `houses` na MESMA
 * transação — `getRepository` devolve os mesmos mocks injetados, então as
 * asserções sobre `staffRepo`/`userRepo` valem dentro e fora da transação.
 *
 * `houseCount` responde ao "esta pessoa é titular de alguma casa?"; `houseUpdate`
 * é a limpeza de `coordinator_id`.
 */
function attachManager(
  staffRepo: MockRepo,
  userRepo: MockRepo,
  options: { isTitular?: boolean; permissionRepo?: MockRepo; periodRepo?: MockRepo } = {},
) {
  const houseUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const houseCount = jest.fn().mockResolvedValue(options.isTitular === false ? 0 : 1);
  // Story 199: a transação é a do AuditService — o evento (audit_logs) entra nela.
  const auditInsert = jest.fn().mockResolvedValue(undefined);
  // Story 216: o período de serviço aberto entra na transação da criação.
  const periodRepo = options.periodRepo ?? makeRepo({
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'period-1', ...v })),
  });
  const entityManager = {
    getRepository: (entity: unknown) => {
      if (entity === AuditLog) return { insert: auditInsert };
      if (entity === StaffServicePeriod) return periodRepo;
      if (entity === StaffPermission) return options.permissionRepo;
      return entity === Staff ? staffRepo : userRepo;
    },
    count: houseCount,
    update: houseUpdate,
    query: jest.fn().mockResolvedValue([]),
  };
  const transaction = jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(entityManager));
  staffRepo.manager = { transaction };
  return { houseUpdate, houseCount, transaction, auditInsert, periodRepo };
}

/** Linhas de auditoria gravadas pela transação do staffRepo (story 199). */
function auditRows(staffRepo: MockRepo): Array<Record<string, unknown>> {
  return ((staffRepo as MockRepo & { auditInsert?: jest.Mock }).auditInsert?.mock.calls ?? []).map(
    ([row]) => row as Record<string, unknown>,
  );
}

// Story 190: o serviço não injeta mais EventEmitter2 — o staffCount por casa é
// lido direto do banco pelo HouseService. Se algum teste voltar a precisar do
// provider aqui, sobrou injeção no serviço.
function makeService(
  staffRepo: MockRepo,
  userRepo: MockRepo,
  permissionRepo: MockRepo,
  storage: Partial<StorageService> = {},
) {
  if (!staffRepo.manager) {
    const { auditInsert } = attachManager(staffRepo, userRepo, { permissionRepo });
    Object.assign(staffRepo, { auditInsert });
  }
  const audit = new AuditService(
    {} as never,
    { transaction: staffRepo.manager!.transaction, query: jest.fn().mockResolvedValue([]) } as never,
  );
  return new StaffService(
    staffRepo as unknown as Repository<Staff>,
    userRepo as unknown as Repository<User>,
    permissionRepo as unknown as Repository<StaffPermission>,
    storage as StorageService,
    audit,
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

// ─── Story 216 — período de serviço nasce com o staff ─────────────────────────
describe('StaffService — período de serviço aberto (story 216)', () => {
  const promotion = {
    name: 'Promovido',
    whatsapp: null,
    houseId: 'house-1',
    photoUrl: null,
    userId: 'user-9',
    formerResidentId: 'res-9',
    rank: 'ASPIRANTE' as never,
    promotedAt: '2026-06-01',
  };

  it('promoção abre período com início = promotedAt e casa do staff, na mesma transação', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo();
    const { periodRepo, transaction } = attachManager(staffRepo, userRepo);
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.createFromResident(promotion);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(periodRepo.save).toHaveBeenCalledWith({
      staffId: 'staff-1',
      houseId: 'house-1',
      startDate: '2026-06-01',
      endDate: null,
    });
  });

  it('falha ao gravar o período desfaz a promoção (erro propaga da transação)', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo();
    const periodRepo = makeRepo({ save: jest.fn().mockRejectedValue(new Error('boom')) });
    attachManager(staffRepo, userRepo, { periodRepo });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await expect(service.createFromResident(promotion)).rejects.toThrow('boom');
  });

  it('cadastro direto abre período com início = hoje e a casa do cadastro', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const { periodRepo } = attachManager(staffRepo, userRepo);
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Direto',
      password: 'secret123',
      role: 'SERVANT' as never,
      houseId: 'house-2',
    } as never);

    expect(periodRepo.save).toHaveBeenCalledWith({
      staffId: 'staff-1',
      houseId: 'house-2',
      startDate: todayInSaoPaulo(),
      endDate: null,
    });
  });

  it('cadastro direto sem casa abre período sem casa', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const { periodRepo } = attachManager(staffRepo, userRepo);
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({ name: 'Sem casa', password: 'secret123', role: 'ADMIN' as never } as never);

    expect(periodRepo.save.mock.calls[0][0]).toMatchObject({ houseId: null, endDate: null });
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

describe('StaffService — maioridade no nascimento (story 202)', () => {
  const MINOR = '2014-08-20';
  const ADULT = '1975-08-20';
  const base = { name: 'Servo', password: 'secret123', role: 'SERVANT' as never };

  function makeEdit(storedBirthDate: string | null) {
    const staffRepo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'staff-1', userId: 'user-1', birthDate: storedBirthDate }),
    });
    const userRepo = makeRepo();
    return { service: makeService(staffRepo, userRepo, makeRepo()), staffRepo, userRepo };
  }

  it('create com 17 anos → 400 com a mensagem, sem criar User nem Staff', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await expect(service.create({ ...base, birthDate: MINOR } as never)).rejects.toThrow(
      MIN_AGE_MESSAGE,
    );
    await expect(service.create({ ...base, birthDate: MINOR } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(staffRepo.save).not.toHaveBeenCalled();
  });

  it('create com 18 anos completos hoje → passa', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());
    const birthDate = maxBirthDateFor(todayInSaoPaulo());

    await service.create({ ...base, birthDate } as never);
    expect(staffRepo.save.mock.calls[0][0].birthDate).toBe(birthDate);
  });

  it('create sem birthDate → passa', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({ ...base, birthDate: null } as never);
    expect(staffRepo.save).toHaveBeenCalledTimes(1);
  });

  it('update com a mesma data de menor já gravada → passa', async () => {
    const { service, staffRepo } = makeEdit(MINOR);

    await service.update('staff-1', { name: 'Novo', birthDate: MINOR } as never);
    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { name: 'Novo', birthDate: MINOR });
  });

  it('update alterando para menor → 400, sem gravar staff nem user', async () => {
    const { service, staffRepo, userRepo } = makeEdit(ADULT);

    await expect(
      service.update('staff-1', { birthDate: MINOR, email: 'x@fonte.com' } as never),
    ).rejects.toThrow(MIN_AGE_MESSAGE);
    expect(staffRepo.update).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('update sem birthDate numa ficha legada de menor → passa', async () => {
    const { service, staffRepo } = makeEdit(MINOR);

    await service.update('staff-1', { name: 'Novo' } as never);
    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { name: 'Novo' });
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

  it('getPermissions lists the permissions of an existing staff', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([{ id: 'perm-1' }]) });
    const service = makeService(staffRepo, makeRepo(), permRepo);

    const result = await service.getPermissions('staff-1');

    expect(permRepo.find).toHaveBeenCalledWith({
      where: { staffId: 'staff-1' },
      order: { permissionType: 'ASC' },
    });
    expect(result).toEqual([{ id: 'perm-1' }]);
  });

  it('addPermission persists a permission that does not exist yet', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) });
    const permRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(staffRepo, makeRepo(), permRepo);

    await service.addPermission('staff-1', 'MANAGE_STOREROOM' as never);

    expect(permRepo.create).toHaveBeenCalledWith({
      staffId: 'staff-1',
      permissionType: 'MANAGE_STOREROOM',
    });
    expect(permRepo.save).toHaveBeenCalled();
  });

  it('removePermission deletes an existing permission', async () => {
    const permRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'perm-1' }) });
    const service = makeService(makeRepo(), makeRepo(), permRepo);

    await service.removePermission('staff-1', 'MANAGE_STOREROOM' as never);

    expect(permRepo.delete).toHaveBeenCalledWith('perm-1');
  });
});

describe('StaffService misc', () => {
  it('existsForFormerResident delegates to the repository', async () => {
    const staffRepo = makeRepo({ exists: jest.fn().mockResolvedValue(true) });
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await expect(service.existsForFormerResident('res-9')).resolves.toBe(true);
    expect(staffRepo.exists).toHaveBeenCalledWith({ where: { formerResidentId: 'res-9' } });
  });

  it('uploadPhotoMe resolves the own staff and uploads the photo', async () => {
    const staffRepo = makeRepo({
      findOne: jest
        .fn()
        // findByUserId
        .mockResolvedValueOnce({ id: 'staff-1', userId: 'user-1', photoUrl: null })
        .mockResolvedValue({ id: 'staff-1', photoUrl: null }),
    });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const storage = {
      uniqueFilename: jest.fn().mockReturnValue('me.jpg'),
      upload: jest.fn().mockResolvedValue('https://cdn/me.jpg'),
    };
    const service = makeService(staffRepo, makeRepo(), permRepo, storage as never);

    await service.uploadPhotoMe('user-1', {
      originalname: 'me.jpg',
      buffer: Buffer.from(''),
      mimetype: 'image/jpeg',
    } as never);

    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { photoUrl: 'https://cdn/me.jpg' });
  });

  it('updateMe rejects an e-mail already used by another user', async () => {
    const staffRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }),
    });
    const userRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'user-2' }) });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const service = makeService(staffRepo, userRepo, permRepo);

    await expect(
      service.updateMe('user-1', { email: 'outro@fonte.com' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('updateMe persists the own e-mail when it is free', async () => {
    const staffRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }),
    });
    const userRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const permRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const service = makeService(staffRepo, userRepo, permRepo);

    await service.updateMe('user-1', { email: 'meu@fonte.com' } as never);

    expect(userRepo.update).toHaveBeenCalledWith('user-1', { email: 'meu@fonte.com' });
  });
});

// Story 190: as mutações que antes emitiam HOUSE_STAFF_CHANGED_EVENT seguem
// funcionando com o módulo de teste SEM nenhum provider de barramento.
describe('StaffService mutations without EventEmitter2', () => {
  it('creates the staff row', async () => {
    const staffRepo = makeRepo();
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 'user-1' }) });
    const service = makeService(staffRepo, userRepo, makeRepo());

    await service.create({
      name: 'Servo',
      email: 'servo3@fonte.com',
      password: 'secret123',
      role: 'SERVANT' as never,
    } as never);

    expect(staffRepo.save).toHaveBeenCalled();
  });

  it('updates the staff house', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await service.update('staff-1', { houseId: 'house-2' } as never);

    expect(staffRepo.update).toHaveBeenCalled();
  });

  it('soft deletes the staff row', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await service.remove('staff-1');

    expect(staffRepo.softDelete).toHaveBeenCalledWith('staff-1');
  });

  it('updates the own profile (updateMe)', async () => {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'user-1' }) });
    const service = makeService(staffRepo, makeRepo(), makeRepo());

    await service.updateMe('user-1', { whatsapp: '11999' } as never);

    expect(staffRepo.update).toHaveBeenCalled();
  });
});

// ─── Story 194 — as três transições que derrubam o titular da casa ────────────
//
// `ON DELETE SET NULL` da FK só dispara em DELETE físico e o projeto usa
// `deleted_at`: quem zera `houses.coordinator_id` é este service.
describe('StaffService — coordenador titular da casa (story 194)', () => {
  function titularService(staff: Record<string, unknown>, options: { isTitular?: boolean } = {}) {
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(staff) });
    const userRepo = makeRepo();
    const manager = attachManager(staffRepo, userRepo, options);
    return { service: makeService(staffRepo, userRepo, makeRepo()), staffRepo, userRepo, ...manager };
  }

  const coordinator = {
    id: 'staff-1',
    userId: 'user-1',
    houseId: 'house-1',
    user: { id: 'user-1', role: 'COORDINATOR' },
  };

  it('soft delete zera o coordinator_id da casa, na mesma transação', async () => {
    const { service, staffRepo, houseUpdate, houseCount, transaction } = titularService(coordinator);

    await service.remove('staff-1');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(staffRepo.softDelete).toHaveBeenCalledWith('staff-1');
    expect(houseCount).toHaveBeenCalledWith(House, { where: { coordinatorId: 'staff-1' } });
    expect(houseUpdate).toHaveBeenCalledWith(
      House,
      { coordinatorId: 'staff-1' },
      { coordinatorId: null },
    );
  });

  it('troca de casa zera o titular da casa ANTIGA e não eleva ninguém na nova', async () => {
    const { service, staffRepo, houseUpdate, transaction } = titularService(coordinator);

    await service.update('staff-1', { houseId: 'house-2' } as never);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(staffRepo.update).toHaveBeenCalledWith('staff-1', { houseId: 'house-2' });
    // A limpeza é pelo staff: só a casa que o apontava (a antiga) perde o titular.
    expect(houseUpdate).toHaveBeenCalledWith(
      House,
      { coordinatorId: 'staff-1' },
      { coordinatorId: null },
    );
    // Nenhuma escrita elege o staff como titular da casa nova.
    expect(houseUpdate).toHaveBeenCalledTimes(1);
    expect(houseUpdate.mock.calls[0][2]).toEqual({ coordinatorId: null });
  });

  it('deixar de ser COORDINATOR zera o titular', async () => {
    const { service, userRepo, houseUpdate } = titularService(coordinator);

    await service.update('staff-1', { role: 'SERVANT' } as never);

    expect(userRepo.update).toHaveBeenCalledWith('user-1', { role: 'SERVANT' });
    expect(houseUpdate).toHaveBeenCalled();
  });

  // Story 214, decisão 6: ADMIN lotado na casa também é coordenador dela —
  // trocar COORDINATOR ↔ ADMIN mantém o titular.
  it('COORDINATOR → ADMIN mantém o titular (story 214)', async () => {
    const { service, userRepo, houseUpdate } = titularService(coordinator);

    await service.update('staff-1', { role: 'ADMIN' } as never);

    expect(userRepo.update).toHaveBeenCalledWith('user-1', { role: 'ADMIN' });
    expect(houseUpdate).not.toHaveBeenCalled();
  });

  const admin = { ...coordinator, user: { id: 'user-1', role: 'ADMIN' } };

  it('ADMIN → COORDINATOR mantém o titular (story 214)', async () => {
    const { service, houseUpdate } = titularService(admin);

    await service.update('staff-1', { role: 'COORDINATOR' } as never);

    expect(houseUpdate).not.toHaveBeenCalled();
  });

  it('ADMIN → SERVANT zera o titular (story 214)', async () => {
    const { service, houseUpdate } = titularService(admin);

    await service.update('staff-1', { role: 'SERVANT' } as never);

    expect(houseUpdate).toHaveBeenCalledWith(
      House,
      { coordinatorId: 'staff-1' },
      { coordinatorId: null },
    );
  });

  it('ADMIN que muda de casa zera o titular (story 214)', async () => {
    const { service, houseUpdate } = titularService(admin);

    await service.update('staff-1', { houseId: 'house-2' } as never);

    expect(houseUpdate).toHaveBeenCalledWith(
      House,
      { coordinatorId: 'staff-1' },
      { coordinatorId: null },
    );
  });

  // O negativo que protege contra zelo excessivo: manutenção de cadastro do
  // titular não pode derrubar a coluna.
  it('trocar telefone, nome e e-mail do titular NÃO mexe na casa', async () => {
    const { service, staffRepo, houseUpdate, transaction } = titularService(coordinator);

    await service.update('staff-1', {
      whatsapp: '(62) 99999-0000',
      name: 'Coordenador Renomeado',
      email: 'novo@fonte.com',
    } as never);

    expect(staffRepo.update).toHaveBeenCalled();
    // Story 199: a escrita sempre roda na transação da auditoria; o que importa
    // aqui é a casa intacta.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(houseUpdate).not.toHaveBeenCalled();
  });

  it('reenviar o MESMO house_id não conta como troca de casa', async () => {
    const { service, houseUpdate, transaction } = titularService(coordinator);

    await service.update('staff-1', { houseId: 'house-1' } as never);

    // Story 199: a escrita sempre roda na transação da auditoria; o que importa
    // aqui é a casa intacta.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(houseUpdate).not.toHaveBeenCalled();
  });

  it('continuar COORDINATOR na mesma casa não derruba nada', async () => {
    const { service, houseUpdate, transaction } = titularService(coordinator);

    await service.update('staff-1', { role: 'COORDINATOR', houseId: 'house-1' } as never);

    // Story 199: a escrita sempre roda na transação da auditoria; o que importa
    // aqui é a casa intacta.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(houseUpdate).not.toHaveBeenCalled();
  });

  // Staff que não é titular de casa nenhuma: as três transições rodam, mas
  // nenhuma delas dispara UPDATE em `houses`.
  it('staff que não é titular de ninguém não gera UPDATE em houses', async () => {
    const servant = { id: 'staff-9', userId: 'user-9', houseId: 'house-1' };

    const onDelete = titularService(servant, { isTitular: false });
    await onDelete.service.remove('staff-9');
    expect(onDelete.houseCount).toHaveBeenCalled();
    expect(onDelete.houseUpdate).not.toHaveBeenCalled();

    const onMove = titularService(servant, { isTitular: false });
    await onMove.service.update('staff-9', { houseId: 'house-2' } as never);
    expect(onMove.houseUpdate).not.toHaveBeenCalled();

    const onRole = titularService(servant, { isTitular: false });
    await onRole.service.update('staff-9', { role: 'SERVANT' } as never);
    expect(onRole.houseUpdate).not.toHaveBeenCalled();
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
