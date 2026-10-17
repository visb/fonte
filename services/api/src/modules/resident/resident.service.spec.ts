jest.mock('@fonte/types', () => ({
  // Story 160 — o módulo real entra primeiro para que as CONSTANTES e os HELPERS
  // compartilhados (ACTIVE_RESIDENT_STATUSES, isTemplateAvailableForStatus,
  // TemplateAvailability) sejam os de verdade: reimplementá-los aqui derrotaria a
  // razão de existir de uma definição única. Os enums abaixo seguem stubados como
  // antes e continuam sobrescrevendo os reais.
  ...jest.requireActual('@fonte/types'),
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
    // Story 196: o guard de transição mapeia mensagem por status de origem,
    // então o stub precisa dos status "mortos" que o enum real tem.
    CENSUS_ADDED: 'CENSUS_ADDED',
    REJECTED_CENSUS: 'REJECTED_CENSUS',
    ARCHIVED: 'ARCHIVED',
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ADMISSION_DATE_MESSAGES,
  FollowUpType,
  maxBirthDateFor,
  MIN_AGE_MESSAGE,
  NotificationType,
  ResidentStatus,
  todayInSaoPaulo,
} from '@fonte/types';
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
    entryDate: new Date('2024-01-01') as unknown as Date,
    exitDate: null,
    status: ResidentStatus.ACTIVE,
    createdAt: new Date(),
    ...overrides,
  } as unknown as Admission;
}

// ─── Fake query builder de admissões (story 164) ──────────────────────────────
//
// `findCurrentAdmission`/`findAdmissions` dependem de `ORDER BY entry_date DESC
// NULLS LAST, created_at DESC` — asserção sobre a chamada do QB provaria só que
// a string foi passada. Este fake APLICA a ordenação declarada sobre uma lista
// em memória, então o teste falha de verdade se a ordem regredir.

type OrderSpec = { column: string; direction: 'ASC' | 'DESC'; nulls?: string };

const ADMISSION_COLUMNS: Record<string, keyof Admission> = {
  'adm.entry_date': 'entryDate',
  'adm.created_at': 'createdAt',
  'adm.exit_date': 'exitDate',
};

function compareValues(a: unknown, b: unknown, spec: OrderSpec): number {
  const aNull = a == null;
  const bNull = b == null;
  if (aNull || bNull) {
    if (aNull && bNull) return 0;
    const nullsLast = spec.nulls === 'NULLS LAST';
    return aNull ? (nullsLast ? 1 : -1) : nullsLast ? -1 : 1;
  }
  const left = a instanceof Date ? a.getTime() : String(a);
  const right = b instanceof Date ? b.getTime() : String(b);
  const sign = left === right ? 0 : left < right ? -1 : 1;
  return spec.direction === 'DESC' ? -sign : sign;
}

function makeAdmissionQb(rows: Admission[]) {
  const orders: OrderSpec[] = [];
  let take: number | null = null;

  const sorted = () => {
    const list = [...rows].sort((a, b) => {
      for (const spec of orders) {
        const field = ADMISSION_COLUMNS[spec.column];
        const result = compareValues(a[field], b[field], spec);
        if (result !== 0) return result;
      }
      return 0;
    });
    return take == null ? list : list.slice(0, take);
  };

  const qb: Record<string, jest.Mock> = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    leftJoinAndSelect: jest.fn(() => qb),
    orderBy: jest.fn((column: string, direction: 'ASC' | 'DESC', nulls?: string) => {
      orders.length = 0;
      orders.push({ column, direction, nulls });
      return qb;
    }),
    addOrderBy: jest.fn((column: string, direction: 'ASC' | 'DESC', nulls?: string) => {
      orders.push({ column, direction, nulls });
      return qb;
    }),
    limit: jest.fn((n: number) => {
      take = n;
      return qb;
    }),
    getMany: jest.fn(async () => sorted()),
    getOne: jest.fn(async () => sorted()[0] ?? null),
  };
  return qb;
}

function makeAdmissionRepo(rows: Admission[], extra: Record<string, jest.Mock> = {}) {
  const qb = makeAdmissionQb(rows);
  return { repo: { createQueryBuilder: jest.fn(() => qb), ...extra }, qb };
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
  notifications: Record<string, jest.Mock> = {
    create: jest.fn().mockResolvedValue(undefined),
  },
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
    notifications as never, // NotificationService
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

  // Story 190: create/update/readmit/remove não dependem mais de EventEmitter2 —
  // a contagem por casa é lida direto do banco. O módulo de teste não fornece o
  // provider; se voltar a ser exigido, sobrou injeção no serviço.
  it('creates without an EventEmitter2 provider in the test module', async () => {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID });
    const service = makeService(
      {
        create: jest.fn().mockReturnValue(saved),
        save: jest.fn().mockResolvedValue(saved),
        findOne: jest.fn().mockResolvedValue(saved),
        update: jest.fn(),
      },
      { create: jest.fn().mockReturnValue(makeAdmission()), save: jest.fn().mockResolvedValue(makeAdmission()) },
    );

    const result = await service.create({
      name: 'Ana',
      houseId: HOUSE_ID,
      status: 'PRE_ADMISSION',
    } as never);

    expect(result).toBe(saved);
  });

  it('removes without an EventEmitter2 provider in the test module', async () => {
    const softDelete = jest.fn().mockResolvedValue({ affected: 1 });
    const service = makeService({
      findOne: jest.fn().mockResolvedValue(makeResident({ id: RESIDENT_ID })),
      softDelete,
    });

    await service.remove(RESIDENT_ID);

    expect(softDelete).toHaveBeenCalledWith(RESIDENT_ID);
  });

  function makeCreateServiceForNotification(status: string) {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID, status: status as Resident['status'] });
    const notificationsCreate = jest.fn().mockResolvedValue(undefined);
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
      { create: notificationsCreate },
    );
    return { service, notificationsCreate };
  }

  it('emits ADMISSION_CREATED when the resident is created already ACTIVE', async () => {
    const { service, notificationsCreate } = makeCreateServiceForNotification('ACTIVE');

    await service.create({ name: 'Ana', houseId: HOUSE_ID, status: 'ACTIVE' } as never);

    // um para ADMIN, um para a casa
    expect(notificationsCreate).toHaveBeenCalledTimes(2);
    expect(notificationsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ADMISSION_CREATED', recipientRole: 'ADMIN' }),
    );
  });

  it('does NOT emit ADMISSION_CREATED for non-ACTIVE statuses', async () => {
    const { service, notificationsCreate } = makeCreateServiceForNotification('PRE_ADMISSION');

    await service.create({ name: 'Ana', houseId: HOUSE_ID, status: 'PRE_ADMISSION' } as never);

    expect(notificationsCreate).not.toHaveBeenCalled();
  });

  it('does NOT emit ADMISSION_CREATED when running inside an import transaction', async () => {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID, status: 'ACTIVE' as Resident['status'] });
    const notificationsCreate = jest.fn().mockResolvedValue(undefined);
    const service = makeService(
      { findOne: jest.fn().mockResolvedValue(saved), update: jest.fn() },
      {},
      undefined,
      undefined,
      undefined,
      undefined,
      { create: notificationsCreate },
    );

    const manager = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn().mockReturnValue(saved),
        save: jest.fn().mockResolvedValue(saved),
      }),
    } as never;

    await service.create({ name: 'Ana', houseId: HOUSE_ID, status: 'ACTIVE' } as never, manager);

    expect(notificationsCreate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// update
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.update', () => {
  function makeUpdateService(currentAdmission: Admission | null = makeAdmission()) {
    return makeUpdateServiceWith(currentAdmission ? [currentAdmission] : []);
  }

  function makeUpdateServiceWith(admissions: Admission[]) {
    const resident = makeResident();
    const residentFindOne = jest.fn().mockResolvedValue(resident);
    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const admissionUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const { repo, qb } = makeAdmissionRepo(admissions, { update: admissionUpdate });

    const service = makeService(
      { findOne: residentFindOne, update: residentUpdate },
      repo as never,
    );

    return { service, residentUpdate, admissionQb: qb, admissionUpdate };
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

  // ── story 164: qual é o "acolhimento atual" ────────────────────────────────

  it('escreve na admissão de MAIOR entry_date mesmo sendo a de created_at mais antigo', async () => {
    // Retrato da ficha importada: o acolhimento antigo é gravado DEPOIS do atual,
    // então `created_at DESC` (o comportamento anterior) devolvia o errado.
    const atual = makeAdmission({
      id: 'adm-atual',
      entryDate: new Date('2026-07-17') as unknown as Date,
      createdAt: new Date('2026-07-10T00:00:00Z'),
    });
    const antigo = makeAdmission({
      id: 'adm-antigo',
      entryDate: new Date('2025-08-01') as unknown as Date,
      createdAt: new Date('2026-07-20T00:00:00Z'),
    });
    const { service, admissionUpdate } = makeUpdateServiceWith([atual, antigo]);

    await service.update(RESIDENT_ID, { houseId: 'new-house' });

    expect(admissionUpdate).toHaveBeenCalledWith('adm-atual', expect.objectContaining({ houseId: 'new-house' }));
  });

  it('admissão sem entry_date não ganha da que tem (NULLS LAST)', async () => {
    const semData = makeAdmission({
      id: 'adm-sem-data',
      entryDate: null,
      createdAt: new Date('2026-08-01T00:00:00Z'),
    });
    const comData = makeAdmission({
      id: 'adm-com-data',
      entryDate: new Date('2024-01-01') as unknown as Date,
      createdAt: new Date('2020-01-01T00:00:00Z'),
    });
    const { service, admissionUpdate } = makeUpdateServiceWith([semData, comData]);

    await service.update(RESIDENT_ID, { houseId: 'new-house' });

    expect(admissionUpdate).toHaveBeenCalledWith('adm-com-data', expect.anything());
  });

  it('empate de entry_date desempata por created_at DESC', async () => {
    const antiga = makeAdmission({
      id: 'adm-antiga',
      entryDate: new Date('2026-01-01') as unknown as Date,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const recente = makeAdmission({
      id: 'adm-recente',
      entryDate: new Date('2026-01-01') as unknown as Date,
      createdAt: new Date('2026-05-01T00:00:00Z'),
    });
    const { service, admissionUpdate } = makeUpdateServiceWith([antiga, recente]);

    await service.update(RESIDENT_ID, { houseId: 'new-house' });

    expect(admissionUpdate).toHaveBeenCalledWith('adm-recente', expect.anything());
  });

  it('consulta a admissão atual por entry_date DESC NULLS LAST + created_at DESC', async () => {
    const { service, admissionQb } = makeUpdateService();

    await service.update(RESIDENT_ID, { houseId: 'new-house' });

    expect(admissionQb.orderBy).toHaveBeenCalledWith('adm.entry_date', 'DESC', 'NULLS LAST');
    expect(admissionQb.addOrderBy).toHaveBeenCalledWith('adm.created_at', 'DESC');
    expect(admissionQb.limit).toHaveBeenCalledWith(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Story 205 — o vínculo filho↔ministério volta (regressão do spec da 197)
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService — vínculo com ministério restaurado (story 205)', () => {
  function makeServiceWithFollowUps() {
    const followUpService = {
      createAuto: jest.fn().mockResolvedValue(undefined),
      getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
    };
    const { repo } = makeAdmissionRepo([makeAdmission()], {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'adm-new', ...v })),
    });
    const service = makeService(
      {
        findOne: jest.fn().mockResolvedValue(makeResident()),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      },
      repo as never,
      {},
      undefined,
      followUpService,
    );
    return { service, followUpService };
  }

  it('update sem ministério nem liderança não emite MINISTRY_CHANGE', async () => {
    const { service, followUpService } = makeServiceWithFollowUps();

    await service.update(RESIDENT_ID, {
      name: 'Outro Nome',
      houseId: 'new-house',
    } as Parameters<typeof service.update>[1]);

    const emitted = followUpService.createAuto.mock.calls.map(([, type]) => type);
    expect(emitted).not.toContain(FollowUpType.MINISTRY_CHANGE);
  });

  it('ministryId volta a ser campo de acolhimento', () => {
    const fields = (ResidentService as unknown as { ADMISSION_FIELDS: Set<string> }).ADMISSION_FIELDS;
    expect(fields.has('ministryId')).toBe(true);
    expect(fields.has('houseId')).toBe(true);
  });

  it('findAll volta a trazer o ministério e a busca segue por nome e CPF', async () => {
    const qb = makeQb([], 0);
    const service = makeService({ createQueryBuilder: jest.fn().mockReturnValue(qb) } as never);

    await service.findAll({ page: 1, limit: 20, search: '123.456' } as ListResidentsDto);

    const wheres = qb.andWhere.mock.calls.map(([sql]) => String(sql));
    expect(wheres.some((w) => w.includes('resident.name') && w.includes('resident.cpf'))).toBe(true);
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('resident.ministry', 'ministry');
  });

  it('o create sem ministério grava ministryId nulo na admissão', async () => {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID });
    const admissionCreate = jest.fn().mockImplementation((v) => v);
    const service = makeService(
      {
        create: jest.fn().mockReturnValue(saved),
        save: jest.fn().mockResolvedValue(saved),
        findOne: jest.fn().mockResolvedValue(saved),
        update: jest.fn(),
      },
      { create: admissionCreate, save: jest.fn().mockResolvedValue(makeAdmission()) },
    );

    await service.create({ name: 'Ana', houseId: HOUSE_ID, status: 'PRE_ADMISSION' } as never);

    expect(admissionCreate.mock.calls[0][0]).toMatchObject({ ministryId: null });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Story 205 — guard (decisão 6) e limpeza na saída (decisão 7)
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService — vínculo com ministério (story 205)', () => {
  const MINISTRY_ID = 'ministry-uuid';
  const ELIGIBLE = ['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE'];
  const INELIGIBLE = ['DISCHARGED', 'EVADED', 'ARCHIVED', 'PRE_ADMISSION', 'CENSUS_ADDED', 'REJECTED_CENSUS'];

  interface Setup {
    resident?: Partial<Resident>;
    ministryHouse?: string | null; // null = ministério não existe
    led?: string[];
  }

  function setup({ resident = {}, ministryHouse = HOUSE_ID, led = [] }: Setup = {}) {
    const before = makeResident({ ministryId: null, ...resident } as Partial<Resident>);
    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const txResidentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const txQuery = jest.fn().mockResolvedValue([]);
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM ministries WHERE id')) {
          return ministryHouse === null ? [] : [{ house_id: ministryHouse }];
        }
        if (sql.includes("leader_type = 'RESIDENT' AND leader_id")) return led.map((id) => ({ id }));
        return [];
      }),
      transaction: jest.fn(async (fn: (m: unknown) => Promise<void>) =>
        fn({ getRepository: () => ({ update: txResidentUpdate }), query: txQuery }),
      ),
    };
    const followUpService = {
      createAuto: jest.fn().mockResolvedValue(undefined),
      getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
    };
    const receivableService = {
      cancelAfterExit: jest.fn().mockResolvedValue(undefined),
      recalcFuturePending: jest.fn().mockResolvedValue(undefined),
      generateSchedule: jest.fn().mockResolvedValue(undefined),
    };
    const admissionUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const { repo: admissionRepo } = makeAdmissionRepo([makeAdmission()], {
      update: admissionUpdate,
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'adm-new', ...v })),
    });
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(before),
      update: residentUpdate,
      create: jest.fn().mockImplementation((v) => ({ id: RESIDENT_ID, ...v })),
      save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
    };
    const service = new ResidentService(
      residentRepo as never,
      {} as never,
      {} as never,
      {} as never,
      admissionRepo as never,
      {} as never,
      followUpService as never,
      receivableService as never,
      {} as never,
      dataSource as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const emitted = () => followUpService.createAuto.mock.calls.map(([, type]) => type);
    return { service, residentUpdate, txResidentUpdate, txQuery, dataSource, admissionUpdate, emitted, residentRepo };
  }

  // ── guard (decisão 6) na ficha ────────────────────────────────────────────

  it.each(ELIGIBLE)('filho %s da casa entra no ministério pela ficha e emite MINISTRY_CHANGE', async (status) => {
    const s = setup({ resident: { status: status as ResidentStatus } });
    await s.service.update(RESIDENT_ID, { ministryId: MINISTRY_ID });
    expect(s.residentUpdate).toHaveBeenCalledWith(RESIDENT_ID, { ministryId: MINISTRY_ID });
    expect(s.admissionUpdate).toHaveBeenCalledWith('admission-uuid', { ministryId: MINISTRY_ID });
    expect(s.emitted()).toEqual([FollowUpType.MINISTRY_CHANGE]);
  });

  it.each(INELIGIBLE)('filho %s → 400 e nada é gravado', async (status) => {
    const s = setup({ resident: { status: status as ResidentStatus } });
    await expect(s.service.update(RESIDENT_ID, { ministryId: MINISTRY_ID })).rejects.toThrow(
      'Só filho em acolhimento nesta casa pode participar do ministério.',
    );
    expect(s.residentUpdate).not.toHaveBeenCalled();
    expect(s.emitted()).toEqual([]);
  });

  it('ministério de outra casa → 400', async () => {
    const s = setup({ ministryHouse: 'other-house' });
    await expect(s.service.update(RESIDENT_ID, { ministryId: MINISTRY_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ministério inexistente/excluído → 400', async () => {
    const s = setup({ ministryHouse: null });
    await expect(s.service.update(RESIDENT_ID, { ministryId: MINISTRY_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('valida contra o estado resultante: transferência + ministério da casa nova passa', async () => {
    const s = setup({ ministryHouse: 'new-house', resident: { ministryId: 'old-min' } as Partial<Resident> });
    await s.service.update(RESIDENT_ID, { houseId: 'new-house', ministryId: MINISTRY_ID });
    expect(s.residentUpdate).toHaveBeenCalledWith(RESIDENT_ID, { houseId: 'new-house', ministryId: MINISTRY_ID });
  });

  it('alta com ministryId no mesmo payload → 400', async () => {
    const s = setup();
    await expect(
      s.service.update(RESIDENT_ID, { status: ResidentStatus.DISCHARGED, ministryId: MINISTRY_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tirar do ministério (ministryId null) não valida e emite MINISTRY_CHANGE', async () => {
    const s = setup({ resident: { ministryId: 'old-min' } as Partial<Resident> });
    await s.service.update(RESIDENT_ID, { ministryId: null });
    expect(s.dataSource.query).not.toHaveBeenCalled();
    expect(s.emitted()).toEqual([FollowUpType.MINISTRY_CHANGE]);
  });

  it('mandar o mesmo ministério de novo não emite evento', async () => {
    const s = setup({ resident: { ministryId: MINISTRY_ID } as Partial<Resident> });
    await s.service.update(RESIDENT_ID, { ministryId: MINISTRY_ID });
    expect(s.emitted()).toEqual([]);
  });

  // ── limpeza na saída (decisão 7) ──────────────────────────────────────────

  it.each([
    ['alta', ResidentStatus.DISCHARGED, FollowUpType.DISCHARGE],
    ['evasão', ResidentStatus.EVADED, FollowUpType.EVASION],
  ])('%s zera ministry_id, limpa a liderança na mesma transação e emite MINISTRY_CHANGE', async (_l, status, exitEvent) => {
    const s = setup({ resident: { ministryId: MINISTRY_ID } as Partial<Resident>, led: ['led-1'] });
    await s.service.update(RESIDENT_ID, { status });

    expect(s.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(s.txResidentUpdate).toHaveBeenCalledWith(RESIDENT_ID, { status, ministryId: null });
    expect(s.txQuery).toHaveBeenCalledWith(
      'UPDATE ministries SET leader_id = NULL, leader_type = NULL WHERE id = ANY($1::uuid[])',
      [['led-1']],
    );
    expect(s.residentUpdate).not.toHaveBeenCalled();
    expect(s.admissionUpdate).toHaveBeenCalledWith('admission-uuid', { status, ministryId: null });
    expect(s.emitted()).toEqual(expect.arrayContaining([FollowUpType.MINISTRY_CHANGE, exitEvent]));
  });

  it('alta de membro que não lidera nada: zera ministry_id sem transação', async () => {
    const s = setup({ resident: { ministryId: MINISTRY_ID } as Partial<Resident> });
    await s.service.update(RESIDENT_ID, { status: ResidentStatus.DISCHARGED });
    expect(s.dataSource.transaction).not.toHaveBeenCalled();
    expect(s.residentUpdate).toHaveBeenCalledWith(RESIDENT_ID, {
      status: ResidentStatus.DISCHARGED,
      ministryId: null,
    });
    expect(s.emitted()).toContain(FollowUpType.MINISTRY_CHANGE);
  });

  it('líder que não é membro: alta limpa a liderança e emite MINISTRY_CHANGE', async () => {
    const s = setup({ led: ['led-1'] });
    await s.service.update(RESIDENT_ID, { status: ResidentStatus.EVADED });
    expect(s.txResidentUpdate).toHaveBeenCalledWith(RESIDENT_ID, { status: ResidentStatus.EVADED });
    expect(s.txQuery).toHaveBeenCalled();
    expect(s.emitted()).toContain(FollowUpType.MINISTRY_CHANGE);
  });

  it('transferência de casa zera ministério e liderança', async () => {
    const s = setup({ resident: { ministryId: MINISTRY_ID } as Partial<Resident>, led: ['led-1'] });
    await s.service.update(RESIDENT_ID, { houseId: 'new-house' });
    expect(s.txResidentUpdate).toHaveBeenCalledWith(RESIDENT_ID, { houseId: 'new-house', ministryId: null });
    expect(s.txQuery).toHaveBeenCalled();
    expect(s.emitted()).toEqual([FollowUpType.MINISTRY_CHANGE]);
  });

  it('mudança dentro do acolhimento (ACTIVE → DISCIPLINE) não limpa nada', async () => {
    const s = setup({ resident: { ministryId: MINISTRY_ID } as Partial<Resident>, led: ['led-1'] });
    await s.service.update(RESIDENT_ID, { status: ResidentStatus.DISCIPLINE });
    expect(s.residentUpdate).toHaveBeenCalledWith(RESIDENT_ID, { status: ResidentStatus.DISCIPLINE });
    expect(s.dataSource.query).not.toHaveBeenCalled();
    expect(s.emitted()).toEqual([]);
  });

  it('transição recusada pelo guard da 196 não limpa nada', async () => {
    const s = setup({
      resident: { status: ResidentStatus.EVADED, ministryId: MINISTRY_ID } as Partial<Resident>,
      led: ['led-1'],
    });
    await expect(s.service.update(RESIDENT_ID, { status: ResidentStatus.DISCHARGED })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(s.dataSource.query).not.toHaveBeenCalled();
    expect(s.dataSource.transaction).not.toHaveBeenCalled();
    expect(s.residentUpdate).not.toHaveBeenCalled();
    expect(s.emitted()).toEqual([]);
  });

  it('reenvio idempotente da mesma alta não limpa de novo', async () => {
    const s = setup({ resident: { status: ResidentStatus.DISCHARGED } });
    await s.service.update(RESIDENT_ID, { status: ResidentStatus.DISCHARGED });
    expect(s.dataSource.query).not.toHaveBeenCalled();
  });

  // ── create (acolhimento) ──────────────────────────────────────────────────

  it('acolhimento ACTIVE com ministério da casa grava o vínculo no filho e na admissão', async () => {
    const s = setup();
    await s.service.create({
      name: 'Ana',
      houseId: HOUSE_ID,
      status: ResidentStatus.ACTIVE,
      ministryId: MINISTRY_ID,
    } as never);
    expect(s.residentRepo.create).toHaveBeenCalledWith(expect.objectContaining({ ministryId: MINISTRY_ID }));
  });

  it('acolhimento em pré-admissão com ministério → 400', async () => {
    const s = setup();
    await expect(
      s.service.create({ name: 'Ana', houseId: HOUSE_ID, ministryId: MINISTRY_ID } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s.residentRepo.save).not.toHaveBeenCalled();
  });

  it('acolhimento dentro de transação valida pelo manager', async () => {
    const s = setup();
    const managerQuery = jest.fn().mockResolvedValue([{ house_id: 'other-house' }]);
    await expect(
      s.service.create(
        { name: 'Ana', houseId: HOUSE_ID, status: ResidentStatus.ACTIVE, ministryId: MINISTRY_ID } as never,
        { query: managerQuery } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(managerQuery).toHaveBeenCalled();
    expect(s.dataSource.query).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// updateIdentity (story 147)
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.updateIdentity', () => {
  it('atualiza SÓ os campos de identidade e retorna o resident', async () => {
    const before = makeResident({ name: 'Ana', cpf: null, rg: null } as Partial<Resident>);
    const after = makeResident({ name: 'Ana Maria', cpf: '12345678900', rg: '123456' } as Partial<Resident>);
    const residentFindOne = jest.fn().mockResolvedValueOnce(before).mockResolvedValue(after);
    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });

    const service = makeService({ findOne: residentFindOne, update: residentUpdate });

    const dto = { name: 'Ana Maria', cpf: '12345678900', rg: '123456' };
    const result = await service.updateIdentity(RESIDENT_ID, dto);

    // O repo.update recebe apenas o dto de identidade — não mistura outros campos.
    expect(residentUpdate).toHaveBeenCalledWith(RESIDENT_ID, dto);
    expect(result).toBe(after);
  });

  it('lança NotFound quando o resident não existe', async () => {
    const residentFindOne = jest.fn().mockRejectedValue(new NotFoundException());
    const residentUpdate = jest.fn();
    const service = makeService({ findOne: residentFindOne, update: residentUpdate });

    await expect(service.updateIdentity(RESIDENT_ID, { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(residentUpdate).not.toHaveBeenCalled();
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

  function makeReadmitService(
    residentOverrides: Partial<Resident> = {},
    closedAdmissions: Admission[] = [],
  ) {
    const resident = makeResident(residentOverrides);
    const updatedResident = makeResident({ ...residentOverrides, status: ResidentStatus.ACTIVE });

    const residentFindOne = jest.fn()
      .mockResolvedValueOnce(resident)      // called inside readmit at start
      .mockResolvedValue(updatedResident);  // called by final findOne

    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const admissionCreate = jest.fn().mockImplementation((v) => v);
    const admissionSave = jest.fn().mockResolvedValue({});
    const userSoftDelete = jest.fn().mockResolvedValue({ affected: 1 });
    const createAuto = jest.fn().mockResolvedValue(undefined);
    const generateSchedule = jest.fn().mockResolvedValue(undefined);
    const notificationsCreate = jest.fn().mockResolvedValue(undefined);

    const service = makeService(
      { findOne: residentFindOne, update: residentUpdate },
      makeAdmissionRepo(closedAdmissions, { create: admissionCreate, save: admissionSave })
        .repo as never,
      { softDelete: userSoftDelete },
      undefined,
      { createAuto, getLastContributionDates: jest.fn().mockResolvedValue(new Map()) },
      {
        getLastPaidDates: jest.fn().mockResolvedValue(new Map()),
        generateSchedule,
        recalcFuturePending: jest.fn().mockResolvedValue(undefined),
        cancelFuturePending: jest.fn().mockResolvedValue(undefined),
        cancelAfterExit: jest.fn().mockResolvedValue(undefined),
      },
      { create: notificationsCreate },
    );

    return {
      service,
      residentFindOne,
      residentUpdate,
      admissionCreate,
      admissionSave,
      userSoftDelete,
      createAuto,
      generateSchedule,
      notificationsCreate,
    };
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

  it('creates new Admission with ACTIVE status and dto fields', async () => {
    const { service, admissionCreate, admissionSave } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
    });

    await service.readmit(RESIDENT_ID, dto);

    expect(admissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: RESIDENT_ID,
        houseId: dto.houseId,
        status: 'ACTIVE',
        healthIssues: dto.healthIssues,
        weight: dto.weight,
        height: dto.height,
        // Story 205: readmissão volta sem ministério.
        ministryId: null,
        exitDate: null,
      }),
    );
    expect(admissionSave).toHaveBeenCalledTimes(1);
  });

  it('resets Resident fields to ACTIVE with new houseId', async () => {
    const { service, residentUpdate } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
    });

    await service.readmit(RESIDENT_ID, dto);

    // Last residentUpdate call (after user revoke is first if userId present)
    const calls = residentUpdate.mock.calls;
    const resetCall = calls.find(([, update]) => update.status === ResidentStatus.ACTIVE);
    expect(resetCall).toBeDefined();
    expect(resetCall![1]).toMatchObject({
      houseId: dto.houseId,
      status: ResidentStatus.ACTIVE,
      ministryId: null,
      exitDate: null,
      photoUrl: null,
      userId: null,
    });
  });

  it('returns the resident with ACTIVE status after readmission', async () => {
    const { service } = makeReadmitService({ status: ResidentStatus.DISCHARGED });

    const result = await service.readmit(RESIDENT_ID, dto);

    expect(result.status).toBe(ResidentStatus.ACTIVE);
  });

  it('emits the ADMISSION_CREATED notification once for ADMIN', async () => {
    const { service, notificationsCreate } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
      houseId: null,
    });

    await service.readmit(RESIDENT_ID, dto);

    expect(notificationsCreate).toHaveBeenCalledTimes(1);
    expect(notificationsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.ADMISSION_CREATED }),
    );
  });

  it('creates the READMISSION follow-up and generates the schedule', async () => {
    const { service, createAuto, generateSchedule } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
    });

    await service.readmit(RESIDENT_ID, dto);

    expect(createAuto).toHaveBeenCalledWith(
      RESIDENT_ID,
      FollowUpType.READMISSION,
      dto.entryDate,
    );
    expect(generateSchedule).toHaveBeenCalledWith(RESIDENT_ID);
  });

  it('uses today as entryDate when dto.entryDate is not provided', async () => {
    const today = todayInSaoPaulo();
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

    const resetCall = residentUpdate.mock.calls.find(([, update]) => update.status === ResidentStatus.ACTIVE);
    expect(resetCall![1]).toMatchObject({ contributionDueDay: 15 });
  });

  it('does NOT set contributionDueDay on the resident update when omitted', async () => {
    const { service, residentUpdate } = makeReadmitService({ status: ResidentStatus.DISCHARGED });
    await service.readmit(RESIDENT_ID, dto);

    const resetCall = residentUpdate.mock.calls.find(([, update]) => update.status === ResidentStatus.ACTIVE);
    expect(resetCall![1]).not.toHaveProperty('contributionDueDay');
  });

  // Story 164, decisão 10: travar a readmissão de quem ainda não negociou o plano
  // é pior que sinalizar na aba Contribuições. O contrato do readmit não muda —
  // a admissão nasce sem plano e o carnê fica vazio até o plano ser definido.
  it('readmissão SEM familyInvestment continua permitida e grava plano nulo', async () => {
    const semPlano: ReadmitResidentDto = { houseId: 'new-house-uuid', entryDate: '2026-07-17' };
    const { service, admissionCreate, residentUpdate, generateSchedule } = makeReadmitService({
      status: ResidentStatus.DISCHARGED,
    });

    await service.readmit(RESIDENT_ID, semPlano);

    expect(admissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ familyInvestment: null, familyInvestmentAmount: null }),
    );
    const resetCall = residentUpdate.mock.calls.find(([, update]) => update.status === ResidentStatus.ACTIVE);
    expect(resetCall![1]).toMatchObject({ familyInvestment: null });
    // O carnê é pedido, mas sem plano `generateSchedule` não materializa parcela.
    expect(generateSchedule).toHaveBeenCalledWith(RESIDENT_ID);
  });

  // ─── Story 203 (decisão 6): entrada nova vs. hoje e vs. última saída ────────
  describe('datas (story 203)', () => {
    const closed = (exitDate: string, entryDate = '2024-01-01') =>
      makeAdmission({
        entryDate: entryDate as unknown as Date,
        exitDate: exitDate as unknown as Date,
        status: ResidentStatus.DISCHARGED,
      });

    it('entrada futura → 400, nada persistido', async () => {
      const { service, admissionSave, residentUpdate, createAuto } = makeReadmitService({
        status: ResidentStatus.DISCHARGED,
      });

      await expect(
        service.readmit(RESIDENT_ID, { houseId: 'h', entryDate: '2999-01-01' }),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.entryFuture);
      expect(admissionSave).not.toHaveBeenCalled();
      expect(residentUpdate).not.toHaveBeenCalled();
      expect(createAuto).not.toHaveBeenCalled();
    });

    it('entrada antes da última saída (admissões) → 400', async () => {
      const { service, admissionSave } = makeReadmitService(
        { status: ResidentStatus.DISCHARGED },
        [closed('2025-03-01', '2024-01-01'), closed('2025-08-10', '2025-05-01')],
      );

      await expect(
        service.readmit(RESIDENT_ID, { houseId: 'h', entryDate: '2025-08-09' }),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2025-08-10'));
      expect(admissionSave).not.toHaveBeenCalled();
    });

    it('entrada = última saída → ok', async () => {
      const { service, admissionSave } = makeReadmitService(
        { status: ResidentStatus.EVADED },
        [closed('2025-08-10')],
      );

      await service.readmit(RESIDENT_ID, { houseId: 'h', entryDate: '2025-08-10' });
      expect(admissionSave).toHaveBeenCalledTimes(1);
    });

    it('usa a saída espelhada no Resident quando é a mais recente', async () => {
      const { service } = makeReadmitService(
        {
          status: ResidentStatus.DISCHARGED,
          exitDate: new Date('2025-09-01T00:00:00Z') as unknown as Date,
        },
        [closed('2025-08-10')],
      );

      await expect(
        service.readmit(RESIDENT_ID, { houseId: 'h', entryDate: '2025-08-20' }),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2025-09-01'));
    });

    it('sem entryDate usa hoje (nunca antes de uma saída passada)', async () => {
      const { service, admissionSave } = makeReadmitService(
        { status: ResidentStatus.DISCHARGED, exitDate: '2025-01-01' as unknown as Date },
      );

      await service.readmit(RESIDENT_ID, { houseId: 'h' });
      expect(admissionSave).toHaveBeenCalledTimes(1);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Story 203 — coerência das datas de entrada e saída (create/update)
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService — datas de entrada e saída (story 203)', () => {
  const TODAY = todayInSaoPaulo();
  const TOMORROW = (() => {
    const d = new Date(`${TODAY}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  function makeCreateService() {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID });
    const residentSave = jest.fn().mockResolvedValue(saved);
    const createAuto = jest.fn().mockResolvedValue(undefined);
    const service = makeService(
      {
        create: jest.fn().mockReturnValue(saved),
        save: residentSave,
        findOne: jest.fn().mockResolvedValue(saved),
      },
      { create: jest.fn().mockReturnValue(makeAdmission()), save: jest.fn().mockResolvedValue(makeAdmission()) },
      undefined,
      undefined,
      { createAuto, getLastContributionDates: jest.fn().mockResolvedValue(new Map()) },
    );
    return { service, residentSave, createAuto };
  }

  function makeUpdateService(before: Resident) {
    const residentUpdate = jest.fn().mockResolvedValue(undefined);
    const { repo: admissionRepo } = makeAdmissionRepo([makeAdmission()], {
      update: jest.fn().mockResolvedValue(undefined),
    });
    const createAuto = jest.fn().mockResolvedValue(undefined);
    const cancelAfterExit = jest.fn().mockResolvedValue(undefined);
    const notify = jest.fn().mockResolvedValue(undefined);
    const service = makeService(
      { findOne: jest.fn().mockResolvedValue(before), update: residentUpdate },
      admissionRepo as never,
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
      { create: notify },
    );
    return { service, residentUpdate, createAuto, cancelAfterExit, notify };
  }

  describe('create', () => {
    it('entrada amanhã → 400, nada persistido', async () => {
      const { service, residentSave, createAuto } = makeCreateService();
      await expect(
        service.create({ name: 'Ana', houseId: HOUSE_ID, entryDate: TOMORROW } as never),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.entryFuture);
      expect(residentSave).not.toHaveBeenCalled();
      expect(createAuto).not.toHaveBeenCalled();
    });

    it('entrada hoje → ok', async () => {
      const { service, residentSave } = makeCreateService();
      await service.create({ name: 'Ana', houseId: HOUSE_ID, entryDate: TODAY } as never);
      expect(residentSave).toHaveBeenCalledTimes(1);
    });

    it('saída < entrada → 400; saída = entrada → ok; saída amanhã → 400', async () => {
      const { service, residentSave } = makeCreateService();
      await expect(
        service.create({
          name: 'Ana',
          houseId: HOUSE_ID,
          entryDate: '2025-05-10',
          exitDate: '2025-05-09',
        } as never),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2025-05-10'));
      await expect(
        service.create({
          name: 'Ana',
          houseId: HOUSE_ID,
          entryDate: '2025-05-10',
          exitDate: TOMORROW,
        } as never),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.exitFuture);
      expect(residentSave).not.toHaveBeenCalled();

      await service.create({
        name: 'Ana',
        houseId: HOUSE_ID,
        entryDate: '2025-05-10',
        exitDate: '2025-05-10',
      } as never);
      expect(residentSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    const stored = { entryDate: '2025-05-10' as unknown as Date, exitDate: null };

    it('alta com saída < entrada gravada → 400, sem cancelAfterExit nem notificação', async () => {
      const { service, residentUpdate, createAuto, cancelAfterExit, notify } = makeUpdateService(
        makeResident({ ...stored, status: ResidentStatus.ACTIVE }),
      );

      await expect(
        service.update(RESIDENT_ID, {
          status: ResidentStatus.DISCHARGED,
          exitDate: '2025-05-09',
        } as never),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2025-05-10'));
      expect(residentUpdate).not.toHaveBeenCalled();
      expect(createAuto).not.toHaveBeenCalled();
      expect(cancelAfterExit).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });

    it('evasão com saída futura → 400', async () => {
      const { service, cancelAfterExit } = makeUpdateService(
        makeResident({ ...stored, status: ResidentStatus.ACTIVE }),
      );

      await expect(
        service.update(RESIDENT_ID, { status: ResidentStatus.EVADED, exitDate: TOMORROW } as never),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.exitFuture);
      expect(cancelAfterExit).not.toHaveBeenCalled();
    });

    it('alterar entrada para depois da saída gravada → 400', async () => {
      const { service, residentUpdate } = makeUpdateService(
        makeResident({
          entryDate: '2025-01-01' as unknown as Date,
          exitDate: '2025-05-01' as unknown as Date,
          status: ResidentStatus.DISCHARGED,
        }),
      );

      await expect(
        service.update(RESIDENT_ID, { entryDate: '2025-06-01' } as never),
      ).rejects.toThrow(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2025-06-01'));
      expect(residentUpdate).not.toHaveBeenCalled();
    });

    it('ficha legada incoerente + payload sem datas → ok', async () => {
      const { service, residentUpdate } = makeUpdateService(
        makeResident({
          entryDate: '2062-01-01' as unknown as Date,
          exitDate: '2020-01-01' as unknown as Date,
          status: ResidentStatus.DISCHARGED,
        }),
      );

      await service.update(RESIDENT_ID, { name: 'Outro' } as never);
      expect(residentUpdate).toHaveBeenCalled();
    });

    it('reenvio idempotente da alta (mesmo status e mesma saída gravada) → ok', async () => {
      const { service, residentUpdate, cancelAfterExit } = makeUpdateService(
        makeResident({
          entryDate: '2025-05-10' as unknown as Date,
          exitDate: '2025-05-09' as unknown as Date, // legado incoerente
          status: ResidentStatus.DISCHARGED,
        }),
      );

      await service.update(RESIDENT_ID, {
        status: ResidentStatus.DISCHARGED,
        exitDate: '2025-05-09',
      } as never);
      expect(residentUpdate).toHaveBeenCalled();
      expect(cancelAfterExit).not.toHaveBeenCalled();
    });

    it('guard de transição (story 196) vem antes da data', async () => {
      const { service } = makeUpdateService(
        makeResident({ ...stored, status: ResidentStatus.EVADED }),
      );

      await expect(
        service.update(RESIDENT_ID, {
          status: ResidentStatus.DISCHARGED,
          exitDate: '2025-05-09',
        } as never),
      ).rejects.toThrow('Filho já encerrado (evasão) não pode ');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// findAdmissions
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService.findAdmissions', () => {
  // Story 164: a ordem é contrato — o adm.fonte numera os acolhimentos e abre a
  // aba Contribuições no índice 0.
  it('devolve do acolhimento mais recente ao mais antigo por entry_date', async () => {
    const antigo = makeAdmission({
      id: 'adm-antigo',
      entryDate: new Date('2025-08-01') as unknown as Date,
      createdAt: new Date('2026-07-20T00:00:00Z'),
    });
    const atual = makeAdmission({
      id: 'adm-atual',
      entryDate: new Date('2026-07-17') as unknown as Date,
      createdAt: new Date('2026-07-10T00:00:00Z'),
    });
    const { repo } = makeAdmissionRepo([antigo, atual]);

    const service = makeService({ findOne: jest.fn().mockResolvedValue(makeResident()) }, repo as never);

    const result = await service.findAdmissions(RESIDENT_ID);

    expect(result.map((a) => a.id)).toEqual(['adm-atual', 'adm-antigo']);
  });

  it('throws NotFoundException when resident does not exist', async () => {
    const residentFindOne = jest.fn().mockRejectedValue(new Error('Resident not found'));
    const { repo } = makeAdmissionRepo([]);

    const service = makeService({ findOne: residentFindOne }, repo as never);

    await expect(service.findAdmissions('non-existent')).rejects.toThrow();
  });

  it('includes house relation in admission query', async () => {
    const { repo, qb } = makeAdmissionRepo([]);

    const service = makeService({ findOne: jest.fn().mockResolvedValue(makeResident()) }, repo as never);

    await service.findAdmissions(RESIDENT_ID);

    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('adm.house', 'house');
    expect(qb.andWhere).toHaveBeenCalledWith('adm.deleted_at IS NULL');
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

  // Story 205 (decisão 7): promoção é alta — tira do ministério e da liderança.
  it('tira o filho promovido do ministério e da liderança', async () => {
    const { service, residentUpdate } = makePromoteService({ userId: USER_ID });

    await service.promoteToServant(RESIDENT_ID, {});

    expect(residentUpdate).toHaveBeenCalledWith(RESIDENT_ID, expect.objectContaining({ ministryId: null }));
    const dataSource = (service as unknown as { dataSource: { query: jest.Mock } }).dataSource;
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE leader_type = 'RESIDENT' AND leader_id = $1"),
      [RESIDENT_ID],
    );
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

  // Story 202, decisão 8: promoção copia a ficha; nada foi informado agora.
  it('promove filho legado com nascimento de menor sem revalidar a idade', async () => {
    const { service, staffService } = makePromoteService({
      userId: USER_ID,
      birthDate: '2015-01-01' as unknown as Date,
    });

    await expect(service.promoteToServant(RESIDENT_ID, {})).resolves.toMatchObject({ id: 'staff-1' });
    expect(staffService.createFromResident).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Story 202 — nascimento só de maiores de 18
// ═════════════════════════════════════════════════════════════════════════════

describe('ResidentService — maioridade no nascimento (story 202)', () => {
  const MINOR = '2015-06-01';
  const ADULT = '1985-06-01';

  function makeCreateService() {
    const saved = makeResident({ id: RESIDENT_ID, houseId: HOUSE_ID });
    const residentSave = jest.fn().mockResolvedValue(saved);
    const followUpService = {
      createAuto: jest.fn().mockResolvedValue(undefined),
      getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
    };
    const service = makeService(
      {
        create: jest.fn().mockReturnValue(saved),
        save: residentSave,
        findOne: jest.fn().mockResolvedValue(saved),
        update: jest.fn(),
      },
      { create: jest.fn().mockReturnValue(makeAdmission()), save: jest.fn().mockResolvedValue(makeAdmission()) },
      undefined,
      undefined,
      followUpService,
    );
    return { service, residentSave, followUpService };
  }

  function makeEditService(storedBirthDate: string | null) {
    const resident = makeResident({ birthDate: storedBirthDate as unknown as Date });
    const residentUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const followUpService = {
      createAuto: jest.fn().mockResolvedValue(undefined),
      getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
    };
    const { repo } = makeAdmissionRepo([makeAdmission()], {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    });
    const service = makeService(
      { findOne: jest.fn().mockResolvedValue(resident), update: residentUpdate },
      repo as never,
      {},
      undefined,
      followUpService,
    );
    return { service, residentUpdate, followUpService };
  }

  describe('create', () => {
    it('17 anos → 400 com MIN_AGE_MESSAGE, nada persistido', async () => {
      const { service, residentSave, followUpService } = makeCreateService();

      await expect(
        service.create({ name: 'Ana', houseId: HOUSE_ID, birthDate: MINOR } as never),
      ).rejects.toThrow(MIN_AGE_MESSAGE);
      expect(residentSave).not.toHaveBeenCalled();
      expect(followUpService.createAuto).not.toHaveBeenCalled();
    });

    it('18 anos completos hoje → passa', async () => {
      const { service, residentSave } = makeCreateService();
      const birthDate = maxBirthDateFor(todayInSaoPaulo());

      await service.create({ name: 'Ana', houseId: HOUSE_ID, birthDate } as never);
      expect(residentSave).toHaveBeenCalledTimes(1);
    });

    it('sem birthDate → passa', async () => {
      const { service, residentSave } = makeCreateService();

      await service.create({ name: 'Ana', houseId: HOUSE_ID, birthDate: null } as never);
      expect(residentSave).toHaveBeenCalledTimes(1);
    });
  });

  describe.each([
    ['update', (s: ResidentService, dto: object) => s.update(RESIDENT_ID, dto as never)],
    ['updateIdentity', (s: ResidentService, dto: object) => s.updateIdentity(RESIDENT_ID, dto as never)],
  ])('%s', (_name, call) => {
    it('ficha gravada com menor + mesma data no payload → passa', async () => {
      const { service, residentUpdate } = makeEditService(MINOR);

      await call(service, { name: 'Outro', birthDate: MINOR });
      expect(residentUpdate).toHaveBeenCalled();
    });

    it('alterando para menor → 400, sem update e sem efeitos colaterais', async () => {
      const { service, residentUpdate, followUpService } = makeEditService(ADULT);

      await expect(
        call(service, { birthDate: MINOR, status: ResidentStatus.DISCHARGED }),
      ).rejects.toThrow(MIN_AGE_MESSAGE);
      expect(residentUpdate).not.toHaveBeenCalled();
      expect(followUpService.createAuto).not.toHaveBeenCalled();
    });

    it('payload sem birthDate (ficha legada menor) → passa', async () => {
      const { service, residentUpdate } = makeEditService(MINOR);

      await call(service, { name: 'Outro' });
      expect(residentUpdate).toHaveBeenCalled();
    });

    it('alterando para adulto → passa', async () => {
      const { service, residentUpdate } = makeEditService(MINOR);

      await call(service, { birthDate: ADULT });
      expect(residentUpdate).toHaveBeenCalled();
    });
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
    const { repo: admissionRepo } = makeAdmissionRepo([makeAdmission()], {
      update: jest.fn().mockResolvedValue(undefined),
    });
    const createAuto = jest.fn().mockResolvedValue(undefined);
    const cancelAfterExit = jest.fn().mockResolvedValue(undefined);
    const notify = jest.fn().mockResolvedValue(undefined);
    const service = makeService(
      residentRepo,
      admissionRepo as never,
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
      { create: notify },
    );
    return { service, createAuto, cancelAfterExit, residentUpdate, notify };
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
    const today = todayInSaoPaulo();

    await service.update(RESIDENT_ID, { status: ResidentStatus.DISCHARGED } as never);

    expect(createAuto).toHaveBeenCalledWith(RESIDENT_ID, 'DISCHARGE', today);
    expect(cancelAfterExit).toHaveBeenCalledWith(RESIDENT_ID, today);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Story 196 — guard das transições de saída.
  //
  // `BUSINESS_RULES.md` sempre afirmou que "status de Resident só muda por
  // transição validada em service"; até esta story, `update` só aplicava o dto.
  // Com a ação de baixa saindo da contagem para a LISTA de filhos (que mostra
  // DISCHARGED/EVADED/ARCHIVED), dar alta em quem já evadiu ficou a um toque.
  // ───────────────────────────────────────────────────────────────────────────

  describe('guard de transição de saída', () => {
    it.each([
      [ResidentStatus.ACTIVE, ResidentStatus.DISCHARGED],
      [ResidentStatus.DISCIPLINE, ResidentStatus.DISCHARGED],
      [ResidentStatus.TEMP_LEAVE, ResidentStatus.EVADED],
      [ResidentStatus.ACTIVE, ResidentStatus.EVADED],
      [ResidentStatus.DISCIPLINE, ResidentStatus.EVADED],
      [ResidentStatus.TEMP_LEAVE, ResidentStatus.DISCHARGED],
    ])('permite %s → %s', async (before, next) => {
      const { service, residentUpdate } = makeUpdateService(makeResident({ status: before }));

      await service.update(RESIDENT_ID, { status: next, exitDate: '2026-06-23' } as never);

      expect(residentUpdate).toHaveBeenCalledWith(
        RESIDENT_ID,
        expect.objectContaining({ status: next }),
      );
    });

    it.each([
      [ResidentStatus.EVADED, ResidentStatus.DISCHARGED, 'Filho já encerrado (evasão)'],
      [ResidentStatus.DISCHARGED, ResidentStatus.EVADED, 'Filho já encerrado (alta)'],
      [ResidentStatus.ARCHIVED, ResidentStatus.EVADED, 'Filho arquivado'],
      [ResidentStatus.ARCHIVED, ResidentStatus.DISCHARGED, 'Filho arquivado'],
      [ResidentStatus.PRE_ADMISSION, ResidentStatus.DISCHARGED, 'Filho em pré-admissão'],
      [
        ResidentStatus.CENSUS_ADDED,
        ResidentStatus.DISCHARGED,
        'Filho aguardando aprovação da contagem',
      ],
      [ResidentStatus.REJECTED_CENSUS, ResidentStatus.EVADED, 'Filho recusado na contagem'],
    ])('recusa %s → %s com 400', async (before, next, subject) => {
      const { service } = makeUpdateService(makeResident({ status: before }));

      await expect(
        service.update(RESIDENT_ID, { status: next, exitDate: '2026-06-23' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Mensagem acionável, por status de origem (substring: o verbo muda com a
      // ação — "receber alta" vs "ser registrado como evasão").
      await expect(
        service.update(RESIDENT_ID, { status: next, exitDate: '2026-06-23' } as never),
      ).rejects.toThrow(`${subject} não pode `);
    });

    // O teste que justifica o guard: sem ele, `cancelAfterExit` e a notificação
    // de alta rodariam de novo em cima de um filho já encerrado.
    it('na recusa não aplica o update nem dispara efeito nenhum', async () => {
      const { service, residentUpdate, createAuto, cancelAfterExit, notify } = makeUpdateService(
        makeResident({ status: ResidentStatus.EVADED }),
      );

      await expect(
        service.update(RESIDENT_ID, {
          status: ResidentStatus.DISCHARGED,
          exitDate: '2026-06-23',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(residentUpdate).not.toHaveBeenCalled();
      expect(createAuto).not.toHaveBeenCalled();
      expect(cancelAfterExit).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });

    // Reenvio da outbox (a rota é `@Idempotent()` por causa do censo offline):
    // a segunda entrega do MESMO item não pode virar 400.
    it.each([ResidentStatus.DISCHARGED, ResidentStatus.EVADED])(
      'reenvio %s → %s (mesmo status) passa sem reaplicar efeitos',
      async (status) => {
        const { service, residentUpdate, createAuto, cancelAfterExit, notify } = makeUpdateService(
          makeResident({ status }),
        );

        await service.update(RESIDENT_ID, { status, exitDate: '2026-06-23' } as never);

        expect(residentUpdate).toHaveBeenCalled();
        expect(createAuto).not.toHaveBeenCalled();
        expect(cancelAfterExit).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
      },
    );

    // O guard olha SÓ as duas transições de saída: a story fecha a porta que ela
    // abre, não reescreve a máquina de estados.
    it.each([
      ResidentStatus.ARCHIVED,
      ResidentStatus.EVADED,
      ResidentStatus.PRE_ADMISSION,
      ResidentStatus.ACTIVE,
    ])('transferência de casa a partir de %s continua livre', async (before) => {
      const { service, residentUpdate } = makeUpdateService(makeResident({ status: before }));

      await service.update(RESIDENT_ID, { houseId: 'new-house' } as never);

      expect(residentUpdate).toHaveBeenCalledWith(
        RESIDENT_ID,
        expect.objectContaining({ houseId: 'new-house' }),
      );
    });

    it('transição que não é de saída (ex.: ARCHIVED → ACTIVE) continua sem restrição', async () => {
      const { service, residentUpdate } = makeUpdateService(
        makeResident({ status: ResidentStatus.ARCHIVED }),
      );

      await service.update(RESIDENT_ID, { status: ResidentStatus.ACTIVE } as never);

      expect(residentUpdate).toHaveBeenCalledWith(
        RESIDENT_ID,
        expect.objectContaining({ status: ResidentStatus.ACTIVE }),
      );
    });
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
