jest.mock('@fonte/types', () => ({
  ResidentStatus: {
    PRE_ADMISSION: 'PRE_ADMISSION',
    ACTIVE: 'ACTIVE',
    DISCIPLINE: 'DISCIPLINE',
    TEMP_LEAVE: 'TEMP_LEAVE',
    DISCHARGED: 'DISCHARGED',
    EVADED: 'EVADED',
  },
  Role: {
    ADMIN: 'ADMIN',
    COORDINATOR: 'COORDINATOR',
    OPERATOR: 'OPERATOR',
    RELATIVE: 'RELATIVE',
    RESIDENT: 'RESIDENT',
  },
}));

import { BadRequestException } from '@nestjs/common';
import { ResidentStatus } from '@fonte/types';
import { Repository } from 'typeorm';
import { ResidentService } from './resident.service';
import { Resident } from './resident.entity';
import { ResidentDocument } from './resident-document.entity';
import { ResidentAttachment } from './resident-attachment.entity';
import { Admission } from './admission.entity';
import { User } from '../user/user.entity';
import { ListResidentsDto } from './dto/list-residents.dto';
import { ReadmitResidentDto } from './dto/readmit-resident.dto';

// ─── Query builder factory ────────────────────────────────────────────────────

function makeQb(data: Resident[], total: number) {
  const qb: Record<string, jest.Mock> = {};
  const chain = (name: string) => {
    qb[name] = jest.fn().mockReturnValue(qb);
    return qb;
  };
  ['leftJoinAndSelect', 'orderBy', 'skip', 'take', 'andWhere'].forEach(chain);
  qb.getManyAndCount = jest.fn().mockResolvedValue([data, total]);
  return qb;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOUSE_ID = 'house-uuid';
const RESIDENT_ID = 'resident-uuid';
const USER_ID = 'user-uuid';

function makeResident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: RESIDENT_ID,
    name: 'Ana',
    status: ResidentStatus.ACTIVE,
    houseId: HOUSE_ID,
    ministryId: null,
    entryDate: new Date('2024-01-01') as unknown as Date,
    exitDate: null,
    userId: null,
    photoUrl: null,
    healthIssues: null,
    continuousMedication: null,
    weight: null,
    height: null,
    familyInvestment: null,
    ...overrides,
  } as unknown as Resident;
}

function makeAdmission(overrides: Partial<Admission> = {}): Admission {
  return {
    id: 'admission-uuid',
    residentId: RESIDENT_ID,
    houseId: HOUSE_ID,
    ministryId: null,
    entryDate: new Date('2024-01-01') as unknown as Date,
    exitDate: null,
    status: ResidentStatus.ACTIVE,
    createdAt: new Date(),
    ...overrides,
  } as unknown as Admission;
}

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(
  residentRepo: Partial<Repository<Resident>>,
  admissionRepo: Partial<Repository<Admission>> = {},
  userRepo: Partial<Repository<User>> = {},
) {
  return new ResidentService(
    residentRepo as Repository<Resident>,
    {} as Repository<ResidentDocument>,
    {} as Repository<ResidentAttachment>,
    userRepo as Repository<User>,
    admissionRepo as Repository<Admission>,
    {} as never, // StorageService
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// findAll
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.findAll', () => {
  let service: ResidentService;
  let qb: ReturnType<typeof makeQb>;

  const mockResident = (name: string, status = ResidentStatus.ACTIVE) =>
    ({ id: 'r1', name, status } as unknown as Resident);

  beforeEach(() => {
    qb = makeQb([], 0);
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as unknown as Repository<Resident>;

    service = makeService(repo);
  });

  it('returns paginated residents with default page/limit', async () => {
    const residents = [mockResident('Ana')];
    qb.getManyAndCount.mockResolvedValue([residents, 1]);

    const dto: ListResidentsDto = {};
    const result = await service.findAll(dto);

    expect(result).toEqual({ data: residents, total: 1, page: 1, limit: 20 });
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('applies correct skip for page > 1', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 50]);

    const dto: ListResidentsDto = { page: 3, limit: 10 };
    const result = await service.findAll(dto);

    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('applies name-only filter when search has no digits', async () => {
    const dto: ListResidentsDto = { search: 'joao' };
    await service.findAll(dto);

    expect(qb.andWhere).toHaveBeenCalledWith(
      'LOWER(resident.name) LIKE LOWER(:search)',
      { search: '%joao%' },
    );
  });

  it('applies CPF filter stripping non-digits when search contains digits', async () => {
    const dto: ListResidentsDto = { search: '123.456.789-00' };
    await service.findAll(dto);

    const whereCalls: Array<[string, Record<string, string>]> = (qb.andWhere as jest.Mock).mock.calls;
    const searchCall = whereCalls.find(([sql]) => sql.includes('resident.name'));
    expect(searchCall).toBeDefined();
    expect(searchCall![1]).toMatchObject({ cpfSearch: '%12345678900%' });
  });

  it('does not apply name/CPF filter when search is absent', async () => {
    const dto: ListResidentsDto = {};
    await service.findAll(dto);

    const whereCalls: string[] = (qb.andWhere as jest.Mock).mock.calls.map((c) => c[0]);
    expect(whereCalls.some((c) => c.includes('resident.name'))).toBe(false);
  });

  it('applies status filter when status is provided', async () => {
    const dto: ListResidentsDto = { status: ResidentStatus.ACTIVE };
    await service.findAll(dto);

    expect(qb.andWhere).toHaveBeenCalledWith('resident.status = :status', {
      status: ResidentStatus.ACTIVE,
    });
  });

  it('does not apply status filter when status is absent', async () => {
    const dto: ListResidentsDto = {};
    await service.findAll(dto);

    const whereCalls: string[] = (qb.andWhere as jest.Mock).mock.calls.map((c) => c[0]);
    expect(whereCalls.some((c) => c.includes('resident.status'))).toBe(false);
  });

  it('applies both search and status filters together', async () => {
    const dto: ListResidentsDto = { search: 'Maria', status: ResidentStatus.DISCIPLINE };
    await service.findAll(dto);

    expect(qb.andWhere).toHaveBeenCalledWith(
      'LOWER(resident.name) LIKE LOWER(:search)',
      { search: '%Maria%' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('resident.status = :status', {
      status: ResidentStatus.DISCIPLINE,
    });
  });

  it('returns correct total from getManyAndCount', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 42]);
    const result = await service.findAll({});
    expect(result.total).toBe(42);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// create
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.create', () => {
  it('saves resident and creates an Admission record with same fields', async () => {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID, status: 'PRE_ADMISSION' as Resident['status'] });
    const createdAdmission = makeAdmission({ residentId: RESIDENT_ID });

    const residentCreate = jest.fn().mockReturnValue(saved);
    const residentSave = jest.fn().mockResolvedValue(saved);
    const residentFindOne = jest.fn().mockResolvedValue(saved);

    const admissionCreate = jest.fn().mockReturnValue(createdAdmission);
    const admissionSave = jest.fn().mockResolvedValue(createdAdmission);

    const service = makeService(
      { create: residentCreate, save: residentSave, findOne: residentFindOne, update: jest.fn() },
      { create: admissionCreate, save: admissionSave },
    );

    const dto = {
      name: 'Ana',
      houseId: HOUSE_ID,
      status: 'PRE_ADMISSION',
      entryDate: new Date('2024-01-01'),
    } as unknown as Parameters<typeof service.create>[0];

    const result = await service.create(dto);

    expect(residentSave).toHaveBeenCalledTimes(1);
    expect(admissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: RESIDENT_ID,
        houseId: HOUSE_ID,
        status: saved.status,
      }),
    );
    expect(admissionSave).toHaveBeenCalledTimes(1);
    expect(result).toBe(saved);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// update
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.update', () => {
  function makeUpdateService(currentAdmission: Admission | null = makeAdmission()) {
    const resident = makeResident();
    const residentFindOne = jest.fn().mockResolvedValue(resident);
    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const admissionFindOne = jest.fn().mockResolvedValue(currentAdmission);
    const admissionUpdate = jest.fn().mockResolvedValue({ affected: 1 });

    const service = makeService(
      { findOne: residentFindOne, update: residentUpdate },
      { findOne: admissionFindOne, update: admissionUpdate },
    );

    return { service, residentUpdate, admissionFindOne, admissionUpdate };
  }

  it('updates admission when ADMISSION_FIELDS are present in dto', async () => {
    const { service, admissionUpdate } = makeUpdateService();

    await service.update(RESIDENT_ID, { houseId: 'new-house', status: 'ACTIVE' as Resident['status'] });

    expect(admissionUpdate).toHaveBeenCalledWith(
      'admission-uuid',
      expect.objectContaining({ houseId: 'new-house', status: 'ACTIVE' }),
    );
  });

  it('does NOT update admission when dto has no ADMISSION_FIELDS', async () => {
    const { service, admissionUpdate } = makeUpdateService();

    await service.update(RESIDENT_ID, { name: 'Novo Nome' } as Parameters<typeof service.update>[1]);

    expect(admissionUpdate).not.toHaveBeenCalled();
  });

  it('does NOT update admission when no current admission exists', async () => {
    const { service, admissionUpdate } = makeUpdateService(null);

    await service.update(RESIDENT_ID, { houseId: 'new-house' });

    expect(admissionUpdate).not.toHaveBeenCalled();
  });

  it('queries latest admission by createdAt DESC', async () => {
    const { service, admissionFindOne } = makeUpdateService();

    await service.update(RESIDENT_ID, { houseId: 'new-house' });

    expect(admissionFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { residentId: RESIDENT_ID },
        order: { createdAt: 'DESC' },
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// readmit
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.readmit', () => {
  const dto: ReadmitResidentDto = {
    houseId: 'new-house-uuid',
    entryDate: '2025-06-01',
    healthIssues: 'nenhum',
    weight: 70,
    height: 175,
  };

  function makeReadmitService(residentOverrides: Partial<Resident> = {}) {
    const resident = makeResident(residentOverrides);
    const updatedResident = makeResident({ ...residentOverrides, status: 'PRE_ADMISSION' as Resident['status'] });

    const residentFindOne = jest.fn()
      .mockResolvedValueOnce(resident)      // called inside readmit at start
      .mockResolvedValue(updatedResident);  // called by final findOne

    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const admissionCreate = jest.fn().mockImplementation((v) => v);
    const admissionSave = jest.fn().mockResolvedValue({});
    const userSoftDelete = jest.fn().mockResolvedValue({ affected: 1 });

    const service = makeService(
      { findOne: residentFindOne, update: residentUpdate },
      { create: admissionCreate, save: admissionSave },
      { softDelete: userSoftDelete },
    );

    return { service, residentFindOne, residentUpdate, admissionCreate, admissionSave, userSoftDelete };
  }

  it('throws BadRequestException when status is ACTIVE', async () => {
    const { service } = makeReadmitService({ status: ResidentStatus.ACTIVE });
    await expect(service.readmit(RESIDENT_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException when status is PRE_ADMISSION', async () => {
    const { service } = makeReadmitService({ status: 'PRE_ADMISSION' as Resident['status'] });
    await expect(service.readmit(RESIDENT_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException when status is DISCIPLINE', async () => {
    const { service } = makeReadmitService({ status: ResidentStatus.DISCIPLINE });
    await expect(service.readmit(RESIDENT_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('succeeds when status is DISCHARGED', async () => {
    const { service } = makeReadmitService({ status: ResidentStatus.DISCHARGED });
    await expect(service.readmit(RESIDENT_ID, dto)).resolves.not.toThrow();
  });

  it('succeeds when status is EVADED', async () => {
    const { service } = makeReadmitService({ status: ResidentStatus.EVADED });
    await expect(service.readmit(RESIDENT_ID, dto)).resolves.not.toThrow();
  });

  it('soft-deletes user when resident has userId', async () => {
    const { service, residentUpdate, userSoftDelete } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
      userId: USER_ID,
    });

    await service.readmit(RESIDENT_ID, dto);

    expect(residentUpdate).toHaveBeenCalledWith(RESIDENT_ID, { userId: null });
    expect(userSoftDelete).toHaveBeenCalledWith(USER_ID);
  });

  it('does NOT soft-delete user when resident has no userId', async () => {
    const { service, userSoftDelete } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
      userId: null,
    });

    await service.readmit(RESIDENT_ID, dto);

    expect(userSoftDelete).not.toHaveBeenCalled();
  });

  it('creates new Admission with PRE_ADMISSION status and dto fields', async () => {
    const { service, admissionCreate, admissionSave } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
    });

    await service.readmit(RESIDENT_ID, dto);

    expect(admissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: RESIDENT_ID,
        houseId: dto.houseId,
        status: 'PRE_ADMISSION',
        healthIssues: dto.healthIssues,
        weight: dto.weight,
        height: dto.height,
        ministryId: null,
        exitDate: null,
      }),
    );
    expect(admissionSave).toHaveBeenCalledTimes(1);
  });

  it('resets Resident fields to PRE_ADMISSION with new houseId', async () => {
    const { service, residentUpdate } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
    });

    await service.readmit(RESIDENT_ID, dto);

    // Last residentUpdate call (after user revoke is first if userId present)
    const calls = residentUpdate.mock.calls;
    const resetCall = calls.find(([, update]) => update.status === 'PRE_ADMISSION');
    expect(resetCall).toBeDefined();
    expect(resetCall![1]).toMatchObject({
      houseId: dto.houseId,
      status: 'PRE_ADMISSION',
      ministryId: null,
      exitDate: null,
      photoUrl: null,
      userId: null,
    });
  });

  it('uses today as entryDate when dto.entryDate is not provided', async () => {
    const today = new Date().toISOString().split('T')[0];
    const dtoWithoutDate: ReadmitResidentDto = { houseId: 'new-house-uuid' };

    const { service, admissionCreate } = makeReadmitService({ status: ResidentStatus.DISCHARGED });
    await service.readmit(RESIDENT_ID, dtoWithoutDate);

    expect(admissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ entryDate: today }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// findAdmissions
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.findAdmissions', () => {
  it('returns admissions ordered by createdAt DESC', async () => {
    const resident = makeResident();
    const admissions = [makeAdmission(), makeAdmission({ id: 'admission-2' })];

    const residentFindOne = jest.fn().mockResolvedValue(resident);
    const admissionFind = jest.fn().mockResolvedValue(admissions);

    const service = makeService(
      { findOne: residentFindOne },
      { find: admissionFind },
    );

    const result = await service.findAdmissions(RESIDENT_ID);

    expect(admissionFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { residentId: RESIDENT_ID },
        order: { createdAt: 'DESC' },
      }),
    );
    expect(result).toBe(admissions);
  });

  it('throws NotFoundException when resident does not exist', async () => {
    const residentFindOne = jest.fn().mockRejectedValue(new Error('Resident not found'));

    const service = makeService({ findOne: residentFindOne }, { find: jest.fn() });

    await expect(service.findAdmissions('non-existent')).rejects.toThrow();
  });

  it('includes house relation in admission query', async () => {
    const resident = makeResident();
    const admissionFind = jest.fn().mockResolvedValue([]);

    const service = makeService(
      { findOne: jest.fn().mockResolvedValue(resident) },
      { find: admissionFind },
    );

    await service.findAdmissions(RESIDENT_ID);

    expect(admissionFind).toHaveBeenCalledWith(
      expect.objectContaining({ relations: ['house'] }),
    );
  });
});
