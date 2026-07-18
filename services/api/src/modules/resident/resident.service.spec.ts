jest.mock('@fonte/types', () => ({
  FamilyInvestment: {
    BASKET_500: 'BASKET_500',
    PAYMENT_700: 'PAYMENT_700',
    SOCIAL: 'SOCIAL',
    NEGOTIATED: 'NEGOTIATED',
  },
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
    SERVANT: 'SERVANT',
    RELATIVE: 'RELATIVE',
    RESIDENT: 'RESIDENT',
  },
  FollowUpType: {
    ADMISSION: 'ADMISSION',
    READMISSION: 'READMISSION',
    DISCHARGE: 'DISCHARGE',
    EVASION: 'EVASION',
    MINISTRY_CHANGE: 'MINISTRY_CHANGE',
    RELATIVE_ADDED: 'RELATIVE_ADDED',
    DOCUMENT_ATTACHED: 'DOCUMENT_ATTACHED',
    MONTHLY_CONTRIBUTION: 'MONTHLY_CONTRIBUTION',
    DISCIPLINE: 'DISCIPLINE',
    BEHAVIOR_ASSESSMENT: 'BEHAVIOR_ASSESSMENT',
    PROMOTED_TO_SERVANT: 'PROMOTED_TO_SERVANT',
    NOTE: 'NOTE',
  },
  NotificationType: {
    ADMISSION_CREATED: 'ADMISSION_CREATED',
    RESIDENT_DISCHARGED: 'RESIDENT_DISCHARGED',
  },
  FollowUpAccessLevel: {
    ALL: 'ALL',
    ADMINISTRATION: 'ADMINISTRATION',
  },
  ReceivableStatus: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    CANCELED: 'CANCELED',
  },
  PaymentMethod: {
    CASH: 'CASH',
    PIX: 'PIX',
    CREDIT_CARD: 'CREDIT_CARD',
    DEBIT_CARD: 'DEBIT_CARD',
    BASKET: 'BASKET',
    OTHER: 'OTHER',
  },
  ServantRank: {
    ASPIRANTE: 'ASPIRANTE',
    CONSAGRADO: 'CONSAGRADO',
    ALIANCADO: 'ALIANCADO',
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
  ['leftJoinAndSelect', 'orderBy', 'addOrderBy', 'skip', 'take', 'andWhere'].forEach(chain);
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
  staffService: Record<string, jest.Mock> = {
    existsForFormerResident: jest.fn().mockResolvedValue(false),
    createFromResident: jest.fn().mockResolvedValue({ id: 'staff-1' }),
  },
  followUpService: Record<string, jest.Mock> = {
    createAuto: jest.fn().mockResolvedValue(undefined),
    getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
  },
  receivableService: Record<string, jest.Mock> = {
    getLastPaidDates: jest.fn().mockResolvedValue(new Map()),
    generateSchedule: jest.fn().mockResolvedValue(undefined),
    recalcFuturePending: jest.fn().mockResolvedValue(undefined),
    cancelFuturePending: jest.fn().mockResolvedValue(undefined),
    cancelAfterExit: jest.fn().mockResolvedValue(undefined),
  },
  eventEmitter: { emit: jest.Mock } = { emit: jest.fn() },
) {
  return new ResidentService(
    residentRepo as Repository<Resident>,
    {} as Repository<ResidentDocument>,
    {} as Repository<ResidentAttachment>,
    userRepo as Repository<User>,
    admissionRepo as Repository<Admission>,
    {} as never, // StorageService
    followUpService as never, // ResidentFollowUpService
    receivableService as never, // ResidentReceivableService
    staffService as never, // StaffService
    { query: jest.fn().mockResolvedValue([]) } as never, // DataSource
    { create: jest.fn().mockResolvedValue(undefined) } as never, // NotificationService
    eventEmitter as never, // EventEmitter2
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
      'unaccent(LOWER(resident.name)) LIKE unaccent(LOWER(:search))',
      { search: '%joao%' },
    );
  });

  it('uses unaccent so accented and unaccented names match', async () => {
    const dto: ListResidentsDto = { search: 'João' };
    await service.findAll(dto);

    const whereCalls: Array<[string, Record<string, string>]> = (qb.andWhere as jest.Mock).mock.calls;
    const searchCall = whereCalls.find(([sql]) => sql.includes('resident.name'));
    expect(searchCall).toBeDefined();
    expect(searchCall![0]).toContain('unaccent(LOWER(resident.name)) LIKE unaccent(LOWER(:search))');
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
      'unaccent(LOWER(resident.name)) LIKE unaccent(LOWER(:search))',
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

  it('applies overdue contribution filters when overdueContribution=true', async () => {
    const dto: ListResidentsDto = { overdueContribution: true };
    await service.findAll(dto);

    const whereCalls: Array<[string, unknown?]> = (qb.andWhere as jest.Mock).mock.calls;
    const sqls = whereCalls.map(([sql]) => sql as string);

    expect(sqls.some((s) => s.includes('resident.contributionExempt = false'))).toBe(true);
    expect(sqls.some((s) => s.includes('overdActiveStatuses'))).toBe(true);
    expect(sqls.some((s) => s.includes('resident_receivables'))).toBe(true);
  });

  it('checks for a mandatory pending receivable past its due date', async () => {
    const dto: ListResidentsDto = { overdueContribution: true };
    await service.findAll(dto);

    const sqls: string[] = (qb.andWhere as jest.Mock).mock.calls.map((c) => c[0] as string);
    const existsClause = sqls.find((s) => s.includes('resident_receivables'));

    expect(existsClause).toBeDefined();
    expect(existsClause).toContain('rcv.mandatory = true');
    expect(existsClause).toContain("rcv.status = 'PENDING'");
    expect(existsClause).toContain('rcv.due_date < CURRENT_DATE');
  });

  it('does not apply overdue contribution filters when overdueContribution is absent', async () => {
    const dto: ListResidentsDto = {};
    await service.findAll(dto);

    const whereCalls: string[] = (qb.andWhere as jest.Mock).mock.calls.map((c) => c[0]);

    expect(whereCalls.some((s) => s.includes('contributionExempt'))).toBe(false);
    expect(whereCalls.some((s) => s.includes('resident_receivables'))).toBe(false);
  });

  // ─── Ordenação (story 129) ────────────────────────────────────────────────

  it('orders by name ASC by default, protecting the ops.fonte alfabetical list (decision 1)', async () => {
    await service.findAll({});

    expect(qb.orderBy).toHaveBeenCalledWith('resident.name', 'ASC', 'NULLS LAST');
  });

  it('orders by entry_date DESC when sort=entryDate & order=desc (mais recentes primeiro)', async () => {
    await service.findAll({ sort: 'entryDate', order: 'desc' });

    expect(qb.orderBy).toHaveBeenCalledWith('resident.entryDate', 'DESC', 'NULLS LAST');
  });

  it('orders by entry_date ASC when sort=entryDate & order=asc (mais antigos primeiro)', async () => {
    await service.findAll({ sort: 'entryDate', order: 'asc' });

    expect(qb.orderBy).toHaveBeenCalledWith('resident.entryDate', 'ASC', 'NULLS LAST');
  });

  it('orders by name DESC when sort=name & order=desc (Z–A)', async () => {
    await service.findAll({ sort: 'name', order: 'desc' });

    expect(qb.orderBy).toHaveBeenCalledWith('resident.name', 'DESC', 'NULLS LAST');
  });

  it('always adds a stable id ASC tiebreaker so pagination does not repeat/skip rows (decision 3)', async () => {
    await service.findAll({ sort: 'entryDate', order: 'desc' });

    expect(qb.addOrderBy).toHaveBeenCalledWith('resident.id', 'ASC');
  });

  it('uses NULLS LAST so a resident without entry_date goes to the end in both directions (decision 4)', async () => {
    await service.findAll({ sort: 'entryDate', order: 'asc' });
    expect(qb.orderBy).toHaveBeenLastCalledWith('resident.entryDate', 'ASC', 'NULLS LAST');

    (qb.orderBy as jest.Mock).mockClear();

    await service.findAll({ sort: 'entryDate', order: 'desc' });
    expect(qb.orderBy).toHaveBeenLastCalledWith('resident.entryDate', 'DESC', 'NULLS LAST');
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

  it('emits resident.counts.changed so the house count cache is invalidated', async () => {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID });
    const emitter = { emit: jest.fn() };
    const service = makeService(
      {
        create: jest.fn().mockReturnValue(saved),
        save: jest.fn().mockResolvedValue(saved),
        findOne: jest.fn().mockResolvedValue(saved),
        update: jest.fn(),
      },
      { create: jest.fn().mockReturnValue(makeAdmission()), save: jest.fn().mockResolvedValue(makeAdmission()) },
      undefined,
      undefined,
      undefined,
      undefined,
      emitter,
    );

    await service.create({ name: 'Ana', houseId: HOUSE_ID, status: 'PRE_ADMISSION' } as never);

    expect(emitter.emit).toHaveBeenCalledWith('resident.counts.changed');
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

  it('propagates contributionDueDay to the resident update when provided', async () => {
    const dtoWithDueDay: ReadmitResidentDto = { houseId: 'new-house-uuid', contributionDueDay: 15 };

    const { service, residentUpdate } = makeReadmitService({ status: ResidentStatus.DISCHARGED });
    await service.readmit(RESIDENT_ID, dtoWithDueDay);

    const resetCall = residentUpdate.mock.calls.find(([, update]) => update.status === 'PRE_ADMISSION');
    expect(resetCall![1]).toMatchObject({ contributionDueDay: 15 });
  });

  it('does NOT set contributionDueDay on the resident update when omitted', async () => {
    const { service, residentUpdate } = makeReadmitService({ status: ResidentStatus.DISCHARGED });
    await service.readmit(RESIDENT_ID, dto);

    const resetCall = residentUpdate.mock.calls.find(([, update]) => update.status === 'PRE_ADMISSION');
    expect(resetCall![1]).not.toHaveProperty('contributionDueDay');
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

// ═════════════════════════════════════════════════════════════════════════════
// promoteToServant
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.promoteToServant', () => {
  const { ConflictException, BadRequestException: BadReq } = jest.requireActual('@nestjs/common');

  function makePromoteService(residentOverrides: Partial<Resident> = {}, alreadyServant = false) {
    const resident = makeResident(residentOverrides);
    const residentFindOne = jest.fn().mockResolvedValue(resident);
    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const userFindOne = jest.fn().mockResolvedValue(null);
    const userUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const userCreate = jest.fn().mockImplementation((v) => v);
    const userSave = jest.fn().mockImplementation((v) => Promise.resolve({ ...v, id: USER_ID }));
    const createAuto = jest.fn().mockResolvedValue(undefined);

    const staffService = {
      existsForFormerResident: jest.fn().mockResolvedValue(alreadyServant),
      createFromResident: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'staff-1', rank: 'ASPIRANTE' }),
    };

    const service = makeService(
      { findOne: residentFindOne, update: residentUpdate },
      {},
      { findOne: userFindOne, update: userUpdate, create: userCreate, save: userSave },
      staffService,
      { createAuto, getLastContributionDates: jest.fn().mockResolvedValue(new Map()) },
    );

    return { service, residentUpdate, userUpdate, userSave, staffService, createAuto };
  }

  it('reuses existing User (RESIDENT→SERVANT) when resident already has access', async () => {
    const { service, userUpdate, userSave, staffService } = makePromoteService({ userId: USER_ID });

    const staff = await service.promoteToServant(RESIDENT_ID, {});

    expect(userUpdate).toHaveBeenCalledWith(USER_ID, { role: 'SERVANT' });
    expect(userSave).not.toHaveBeenCalled();
    expect(staffService.createFromResident).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, formerResidentId: RESIDENT_ID, rank: 'ASPIRANTE' }),
    );
    expect(staff).toMatchObject({ id: 'staff-1' });
  });

  it('creates a new User when resident has no access and email/password provided', async () => {
    const { service, userSave, staffService } = makePromoteService({ userId: null });

    await service.promoteToServant(RESIDENT_ID, { email: 'novo@fonte.org', password: 'secret123' });

    expect(userSave).toHaveBeenCalledTimes(1);
    expect(staffService.createFromResident).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
    );
  });

  it('creates a User with null email when resident has no access and only password provided', async () => {
    const { service, userSave, staffService } = makePromoteService({ userId: null });

    await service.promoteToServant(RESIDENT_ID, { password: 'secret123' });

    expect(userSave).toHaveBeenCalledWith(expect.objectContaining({ email: null, role: 'SERVANT' }));
    expect(staffService.createFromResident).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
    );
  });

  it('throws when resident has no access and password is missing', async () => {
    const { service } = makePromoteService({ userId: null });

    await expect(service.promoteToServant(RESIDENT_ID, {})).rejects.toBeInstanceOf(BadReq);
  });

  it('rejects double conversion', async () => {
    const { service } = makePromoteService({ userId: USER_ID }, true);

    await expect(service.promoteToServant(RESIDENT_ID, {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('archives the filho as DISCHARGED and logs PROMOTED_TO_SERVANT follow-up', async () => {
    const { service, residentUpdate, createAuto } = makePromoteService({ userId: USER_ID });

    await service.promoteToServant(RESIDENT_ID, {});

    expect(residentUpdate).toHaveBeenCalledWith(
      RESIDENT_ID,
      expect.objectContaining({ status: 'DISCHARGED' }),
    );
    expect(createAuto).toHaveBeenCalledWith(RESIDENT_ID, 'PROMOTED_TO_SERVANT', expect.any(String));
  });

  it('uses the provided date for exit, timeline and staff promotedAt', async () => {
    const { service, residentUpdate, createAuto, staffService } = makePromoteService({ userId: USER_ID });

    await service.promoteToServant(RESIDENT_ID, { date: '2026-01-15' });

    expect(residentUpdate).toHaveBeenCalledWith(
      RESIDENT_ID,
      expect.objectContaining({ exitDate: '2026-01-15' }),
    );
    expect(createAuto).toHaveBeenCalledWith(RESIDENT_ID, 'PROMOTED_TO_SERVANT', '2026-01-15');
    expect(staffService.createFromResident).toHaveBeenCalledWith(
      expect.objectContaining({ promotedAt: '2026-01-15' }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// update — exit-driven events (discharge / evasion)
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.update exit events', () => {
  function makeUpdateService(before: Resident) {
    const residentUpdate = jest.fn().mockResolvedValue(undefined);
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(before),
      update: residentUpdate,
    } as unknown as Partial<Repository<Resident>>;
    const admissionRepo = {
      findOne: jest.fn().mockResolvedValue(makeAdmission()),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as Partial<Repository<Admission>>;
    const createAuto = jest.fn().mockResolvedValue(undefined);
    const cancelAfterExit = jest.fn().mockResolvedValue(undefined);
    const service = makeService(
      residentRepo,
      admissionRepo,
      {},
      undefined,
      { createAuto, getLastContributionDates: jest.fn().mockResolvedValue(new Map()) },
      {
        getLastPaidDates: jest.fn().mockResolvedValue(new Map()),
        generateSchedule: jest.fn().mockResolvedValue(undefined),
        recalcFuturePending: jest.fn().mockResolvedValue(undefined),
        cancelFuturePending: jest.fn().mockResolvedValue(undefined),
        cancelAfterExit,
      },
    );
    return { service, createAuto, cancelAfterExit, residentUpdate };
  }

  it('dates the DISCHARGE follow-up and receivable cancel by the provided exitDate', async () => {
    const { service, createAuto, cancelAfterExit } = makeUpdateService(
      makeResident({ status: ResidentStatus.ACTIVE }),
    );

    await service.update(RESIDENT_ID, {
      status: ResidentStatus.DISCHARGED,
      exitDate: '2026-02-10',
    } as never);

    expect(createAuto).toHaveBeenCalledWith(RESIDENT_ID, 'DISCHARGE', '2026-02-10');
    expect(cancelAfterExit).toHaveBeenCalledWith(RESIDENT_ID, '2026-02-10');
  });

  it('dates the EVASION follow-up and receivable cancel by the provided exitDate', async () => {
    const { service, createAuto, cancelAfterExit } = makeUpdateService(
      makeResident({ status: ResidentStatus.ACTIVE }),
    );

    await service.update(RESIDENT_ID, {
      status: ResidentStatus.EVADED,
      exitDate: '2026-03-05',
    } as never);

    expect(createAuto).toHaveBeenCalledWith(RESIDENT_ID, 'EVASION', '2026-03-05');
    expect(cancelAfterExit).toHaveBeenCalledWith(RESIDENT_ID, '2026-03-05');
  });

  it('falls back to today when exitDate is not provided', async () => {
    const { service, createAuto, cancelAfterExit } = makeUpdateService(
      makeResident({ status: ResidentStatus.ACTIVE }),
    );
    const today = new Date().toISOString().split('T')[0];

    await service.update(RESIDENT_ID, { status: ResidentStatus.DISCHARGED } as never);

    expect(createAuto).toHaveBeenCalledWith(RESIDENT_ID, 'DISCHARGE', today);
    expect(cancelAfterExit).toHaveBeenCalledWith(RESIDENT_ID, today);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getContributionsReport — totalCollectedAmount uses the real paid amount
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.getContributionsReport', () => {
  function makeServiceWithRows(rows: unknown[]) {
    const query = jest.fn().mockResolvedValue(rows);
    const service = new ResidentService(
      {} as Repository<Resident>,
      {} as Repository<ResidentDocument>,
      {} as Repository<ResidentAttachment>,
      {} as Repository<User>,
      {} as Repository<Admission>,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { query } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { emit: jest.fn() } as never,
    );
    return { service, query };
  }

  it('sums the real paid_amount for paid installments, with fallback to the snapshot', async () => {
    const { service } = makeServiceWithRows([
      // paid, diverging paid amount (300 < expected 700)
      { residentId: 'r1', residentName: 'A', houseId: 'h', houseName: 'H', familyInvestment: 'PAYMENT_700', expectedAmount: 700, collectedAmount: 300, paid: true, paidAt: '2026-06-01' },
      // paid, no paid_amount recorded → falls back to expected (500)
      { residentId: 'r2', residentName: 'B', houseId: 'h', houseName: 'H', familyInvestment: 'BASKET_500', expectedAmount: 500, collectedAmount: null, paid: true, paidAt: '2026-06-02' },
      // pending → not counted in collected total
      { residentId: 'r3', residentName: 'C', houseId: 'h', houseName: 'H', familyInvestment: 'PAYMENT_700', expectedAmount: 700, collectedAmount: null, paid: false, paidAt: null },
    ]);

    const report = await service.getContributionsReport({ month: '2026-06' } as never);

    expect(report.totalPaid).toBe(2);
    expect(report.totalPending).toBe(1);
    // expected total uses the plan: 700 + 500 + 700
    expect(report.totalExpectedAmount).toBe(1900);
    // collected total uses real paid amount (300) + fallback snapshot (500) = 800
    expect(report.totalCollectedAmount).toBe(800);
    expect(report.items[0].collectedAmount).toBe(300);
  });
});

describe('ResidentService.findAll house scoping', () => {
  function makeScopedService(staffService: Record<string, jest.Mock>) {
    const qb = makeQb([], 0);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) } as unknown as Repository<Resident>;
    const service = makeService(repo, {}, {}, staffService);
    return { service, qb };
  }

  it('forces the caller house for non-admin and ignores dto.houseId', async () => {
    const staffService = { findByUserId: jest.fn().mockResolvedValue({ houseId: 'house-9' }) };
    const { service, qb } = makeScopedService(staffService);

    await service.findAll({ houseId: 'other-house' }, { role: 'SERVANT', userId: 'u1' });

    expect(staffService.findByUserId).toHaveBeenCalledWith('u1');
    expect(qb.andWhere).toHaveBeenCalledWith('resident.houseId = :houseId', { houseId: 'house-9' });
  });

  it('returns empty when non-admin caller has no house', async () => {
    const staffService = { findByUserId: jest.fn().mockResolvedValue({ houseId: null }) };
    const { service, qb } = makeScopedService(staffService);

    const result = await service.findAll({}, { role: 'SERVANT', userId: 'u1' });

    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });

  it('does not scope ADMIN callers', async () => {
    const staffService = { findByUserId: jest.fn() };
    const { service } = makeScopedService(staffService);

    await service.findAll({}, { role: 'ADMIN', userId: 'admin-1' });

    expect(staffService.findByUserId).not.toHaveBeenCalled();
  });

  it('keeps the house scope even when a custom sort/order is requested (LGPD regression, story 129)', async () => {
    const staffService = { findByUserId: jest.fn().mockResolvedValue({ houseId: 'house-9' }) };
    const { service, qb } = makeScopedService(staffService);

    await service.findAll(
      { sort: 'entryDate', order: 'desc' },
      { role: 'SERVANT', userId: 'u1' },
    );

    expect(qb.andWhere).toHaveBeenCalledWith('resident.houseId = :houseId', { houseId: 'house-9' });
    expect(qb.orderBy).toHaveBeenCalledWith('resident.entryDate', 'DESC', 'NULLS LAST');
  });
});

describe('ResidentService.findAdmissionDocuments', () => {
  it('composes admission templates with the resident signed status', async () => {
    const residentFindOne = jest.fn().mockResolvedValue(makeResident());
    const docFind = jest.fn().mockResolvedValue([
      { templateId: 't1', signedFileUrl: 'http://x/url.pdf', updatedAt: new Date('2026-01-01') },
    ]);
    const service = new ResidentService(
      { findOne: residentFindOne } as never,                                  // residentRepository
      { find: docFind } as never,                                             // docRepository
      {} as never,                                                            // attachmentRepository
      {} as never,                                                            // userRepository
      {} as never,                                                            // admissionRepository
      {} as never,                                                            // storageService
      { getLastContributionDates: jest.fn().mockResolvedValue(new Map()) } as never, // followUpService
      {} as never,                                                            // receivableService
      {} as never,                                                            // staffService
      {} as never,                                                            // dataSource
      {} as never,                                                            // notifications
      { emit: jest.fn() } as never,                                           // eventEmitter
    );

    const result = await service.findAdmissionDocuments(RESIDENT_ID, [
      { id: 't1', name: 'Termo de Imagem' },
      { id: 't2', name: 'Aviso de Privacidade' },
    ]);

    expect(result[0]).toMatchObject({
      templateId: 't1',
      templateName: 'Termo de Imagem',
      signed: true,
      signedFileUrl: 'http://x/url.pdf',
    });
    expect(result[0].pdfPath).toContain('/documents/t1/pdf');
    expect(result[1]).toMatchObject({ templateId: 't2', signed: false, signedFileUrl: null });
  });
});
