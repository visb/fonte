jest.mock('@fonte/types', () => ({
  // Story 160 — ACTIVE_STATUSES do service passou a vir de @fonte/types
  // (ACTIVE_RESIDENT_STATUSES): o módulo real entra primeiro para o stub não
  // apagar a constante. Os enums abaixo seguem stubados como antes.
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
  },
  ReceivableStatus: { PENDING: 'PENDING', PAID: 'PAID', CANCELED: 'CANCELED' },
  PaymentMethod: { CASH: 'CASH', PIX: 'PIX', CREDIT_CARD: 'CREDIT_CARD', DEBIT_CARD: 'DEBIT_CARD', BASKET: 'BASKET', OTHER: 'OTHER' },
  NotificationType: { PAYMENT_REGISTERED: 'PAYMENT_REGISTERED' },
  Role: { ADMIN: 'ADMIN', COORDINATOR: 'COORDINATOR', SERVANT: 'SERVANT', RELATIVE: 'RELATIVE', RESIDENT: 'RESIDENT' },
}));

import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ResidentReceivableService } from './resident-receivable.service';
import { ResidentReceivable } from './resident-receivable.entity';
import { Admission } from '../resident/admission.entity';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';

interface MockRepo {
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
}

function makeRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
    create: jest.fn().mockImplementation((v) => v),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function makeResident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'res-1',
    status: 'ACTIVE',
    entryDate: '2026-01-15' as unknown as Date,
    familyInvestment: 'PAYMENT_700',
    familyInvestmentAmount: null,
    contributionDueDay: null,
    contributionExempt: false,
    ...overrides,
  } as Resident;
}

// Story 164: o service resolve o acolhimento dono de cada competência. Sem
// admissão cadastrada o vínculo é `null` — que é o default aqui.
function makeAdmissionRepo(admissions: Partial<Admission>[] = []): { find: jest.Mock } {
  return { find: jest.fn().mockResolvedValue(admissions) };
}

function makeService(
  repo: MockRepo,
  residentRepo: Partial<Repository<Resident>>,
  admissionRepo: { find: jest.Mock } = makeAdmissionRepo(),
) {
  return new ResidentReceivableService(
    repo as unknown as Repository<ResidentReceivable>,
    residentRepo as Repository<Resident>,
    admissionRepo as unknown as Repository<Admission>,
    {} as Repository<Staff>,
    {} as never, // StorageService
    { create: jest.fn().mockResolvedValue(undefined) } as never, // NotificationService
    { mapByReceivables: jest.fn().mockResolvedValue(new Map()) } as never, // ReceivableProductContributionService
  );
}

function makeFullService(
  repo: MockRepo,
  residentRepo: Partial<Repository<Resident>>,
  staffRepo: Partial<Repository<Staff>>,
  storage: Record<string, jest.Mock> = {},
) {
  // registerPayment emits a best-effort notification that reads the resident
  // name; provide a default findOne so the happy path does not log warnings.
  const residentRepoWithFind = {
    findOne: jest.fn().mockResolvedValue({ name: 'Acolhido' }),
    ...residentRepo,
  };
  return new ResidentReceivableService(
    repo as unknown as Repository<ResidentReceivable>,
    residentRepoWithFind as Repository<Resident>,
    makeAdmissionRepo() as unknown as Repository<Admission>,
    staffRepo as Repository<Staff>,
    storage as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never, // NotificationService
    { mapByReceivables: jest.fn().mockResolvedValue(new Map()) } as never, // ReceivableProductContributionService
  );
}

describe('ResidentReceivableService.generateSchedule', () => {
  it('creates 6 mandatory installments from the entry month with the canonical amount', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved).toHaveLength(6);
    expect(saved.every((r) => r.mandatory)).toBe(true);
    expect(saved.every((r) => r.amount === 700)).toBe(true);
    expect(saved.map((r) => r.referenceMonth)).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
    ]);
    expect(saved[0].dueDate).toBe('2026-01-15');
  });

  it('uses familyInvestmentAmount for a NEGOTIATED plan', async () => {
    const repo = makeRepo();
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(
        makeResident({ familyInvestment: 'NEGOTIATED' as never, familyInvestmentAmount: 350 }),
      ),
    };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');

    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved.every((r) => r.amount === 350)).toBe(true);
  });

  it('skips months that already exist', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([{ referenceMonth: '2026-01-01' }, { referenceMonth: '2026-02-01' }]),
    });
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');

    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved).toHaveLength(4);
  });

  it('generates nothing for a SOCIAL plan', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident({ familyInvestment: 'SOCIAL' as never })) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('generates nothing for an exempt resident', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident({ contributionExempt: true })) };
    const service = makeService(repo, residentRepo);

    await service.generateSchedule('res-1');
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('ResidentReceivableService.ensureFutureOpen', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('rolls voluntary (non-mandatory) months beyond the 6-month window up to next month', async () => {
    const repo = makeRepo();
    const service = makeService(repo, {});

    // Entry Jan 2026 → mandatory Jan–Jun; now Sep → should fill Jul..Oct as voluntary.
    await service.ensureFutureOpen(makeResident());

    const saved = repo.save.mock.calls[0][0] as Array<{ referenceMonth: string; mandatory: boolean }>;
    const months = saved.map((r) => r.referenceMonth);
    expect(months).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
      '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01',
    ]);
    const july = saved.find((r) => r.referenceMonth === '2026-07-01')!;
    expect(july.mandatory).toBe(false);
    const june = saved.find((r) => r.referenceMonth === '2026-06-01')!;
    expect(june.mandatory).toBe(true);
  });
});

describe('ResidentReceivableService.cancelFuturePending', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('cancels only pending installments from the current month onward', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'a', referenceMonth: '2026-01-01' },
        { id: 'b', referenceMonth: '2026-03-01' },
        { id: 'c', referenceMonth: '2026-04-01' },
      ]),
    });
    const service = makeService(repo, {});

    await service.cancelFuturePending('res-1');

    expect(repo.update).toHaveBeenCalledTimes(1);
    const [criteria, patch] = repo.update.mock.calls[0];
    expect(patch).toEqual({ status: 'CANCELED' });
    // Only March and April (>= current month); January excluded.
    expect(criteria.id._value).toEqual(['b', 'c']);
  });
});

describe('ResidentReceivableService.cancelAfterExit', () => {
  it('cancels only pending installments after the exit month', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'a', referenceMonth: '2026-03-01' }, // exit month — kept
        { id: 'b', referenceMonth: '2026-04-01' }, // after — canceled
        { id: 'c', referenceMonth: '2026-05-01' }, // after — canceled
      ]),
    });
    const service = makeService(repo, {});

    await service.cancelAfterExit('res-1', '2026-03-20');

    expect(repo.update).toHaveBeenCalledTimes(1);
    const [criteria, patch] = repo.update.mock.calls[0];
    expect(patch).toEqual({ status: 'CANCELED' });
    expect(criteria.id._value).toEqual(['b', 'c']);
  });

  it('does nothing when no installment is past the exit month', async () => {
    const repo = makeRepo({ find: jest.fn().mockResolvedValue([{ id: 'a', referenceMonth: '2026-01-01' }]) });
    const service = makeService(repo, {});
    await service.cancelAfterExit('res-1', '2026-06-20');
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('ResidentReceivableService.registerPayment', () => {
  it('throws NotFound when the receivable does not belong to the resident', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeFullService(repo, {}, { findOne: jest.fn() });
    await expect(
      service.registerPayment('res-1', 'rcv-1', { paidAt: '2026-06-01', paymentMethod: 'PIX' } as never, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks the receivable PAID with the payment data and author', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rcv-1', residentId: 'res-1', attachmentUrl: null })
        .mockResolvedValue({ id: 'rcv-1', createdBy: { name: 'Servo' } }),
    });
    const staffRepo = { findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) };
    const service = makeFullService(repo, {}, staffRepo);

    const view = await service.registerPayment(
      'res-1',
      'rcv-1',
      { paidAt: '2026-06-01', paymentMethod: 'PIX', notes: 'ok' } as never,
      'user-1',
    );

    const [id, patch] = repo.update.mock.calls[0];
    expect(id).toBe('rcv-1');
    expect(patch).toMatchObject({ status: 'PAID', paidAt: '2026-06-01', paymentMethod: 'PIX', notes: 'ok', createdById: 'staff-1' });
    expect(view.createdByName).toBe('Servo');
  });

  it('persists paidAmount/paidFamilyInvestment when provided (diverging from snapshot)', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rcv-1', residentId: 'res-1', attachmentUrl: null, amount: 700, familyInvestment: 'PAYMENT_700' })
        .mockResolvedValue({ id: 'rcv-1', createdBy: null }),
    });
    const staffRepo = { findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) };
    const service = makeFullService(repo, {}, staffRepo);

    await service.registerPayment(
      'res-1',
      'rcv-1',
      { paidAt: '2026-06-01', paymentMethod: 'PIX', paidAmount: 300, paidFamilyInvestment: 'NEGOTIATED' } as never,
      'user-1',
    );

    const [, patch] = repo.update.mock.calls[0];
    expect(patch).toMatchObject({ paidAmount: 300, paidFamilyInvestment: 'NEGOTIATED' });
  });

  it('defaults paidAmount/paidFamilyInvestment to the snapshot when not provided', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rcv-1', residentId: 'res-1', attachmentUrl: null, amount: 700, familyInvestment: 'PAYMENT_700' })
        .mockResolvedValue({ id: 'rcv-1', createdBy: null }),
    });
    const staffRepo = { findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) };
    const service = makeFullService(repo, {}, staffRepo);

    await service.registerPayment(
      'res-1',
      'rcv-1',
      { paidAt: '2026-06-01', paymentMethod: 'PIX' } as never,
      'user-1',
    );

    const [, patch] = repo.update.mock.calls[0];
    expect(patch).toMatchObject({ paidAmount: 700, paidFamilyInvestment: 'PAYMENT_700' });
  });

  it('clears paidAmount/paidFamilyInvestment on reopen', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rcv-1', residentId: 'res-1', attachmentUrl: null })
        .mockResolvedValue({ id: 'rcv-1', createdBy: null }),
    });
    const service = makeFullService(repo, {}, {}, { delete: jest.fn() });

    await service.reopenPayment('res-1', 'rcv-1');

    expect(repo.update.mock.calls[0][1]).toMatchObject({ paidAmount: null, paidFamilyInvestment: null });
  });

  it('uploads the attachment, deleting the previous one', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rcv-1', residentId: 'res-1', attachmentUrl: 'old.pdf' })
        .mockResolvedValue({ id: 'rcv-1', createdBy: null }),
    });
    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn().mockReturnValue('new.pdf'),
      upload: jest.fn().mockResolvedValue('https://cdn/new.pdf'),
    };
    const service = makeFullService(repo, {}, { findOne: jest.fn().mockResolvedValue(null) }, storage);

    await service.registerPayment(
      'res-1',
      'rcv-1',
      { paidAt: '2026-06-01', paymentMethod: 'PIX' } as never,
      'user-1',
      { originalname: 'p.pdf', buffer: Buffer.from(''), mimetype: 'application/pdf' } as never,
    );

    expect(storage.delete).toHaveBeenCalledWith('old.pdf');
    expect(repo.update.mock.calls[0][1].attachmentUrl).toBe('https://cdn/new.pdf');
  });
});

describe('ResidentReceivableService.reopenPayment', () => {
  it('resets the receivable to PENDING and clears payment fields', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'rcv-1', residentId: 'res-1', attachmentUrl: 'p.pdf' })
        .mockResolvedValue({ id: 'rcv-1', createdBy: null }),
    });
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = makeFullService(repo, {}, {}, storage);

    await service.reopenPayment('res-1', 'rcv-1');

    expect(storage.delete).toHaveBeenCalledWith('p.pdf');
    expect(repo.update.mock.calls[0][1]).toMatchObject({ status: 'PENDING', paidAt: null, paymentMethod: null, attachmentUrl: null });
  });
});

describe('ResidentReceivableService.recalcFuturePending', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('cancels future pending when the resident becomes exempt', async () => {
    const cancelSpy = jest.fn();
    const repo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident({ contributionExempt: true })) };
    const service = makeService(repo, residentRepo);
    service.cancelFuturePending = cancelSpy;

    await service.recalcFuturePending('res-1');
    expect(cancelSpy).toHaveBeenCalledWith('res-1');
  });

  it('reprices future pending installments after a plan change', async () => {
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(
        makeResident({ familyInvestment: 'NEGOTIATED' as never, familyInvestmentAmount: 420 }),
      ),
    };
    // generateSchedule reads existing months (find #1), then materializes (save).
    // recalc then loads future pendings (find #2) to reprice.
    const repo = makeRepo({
      find: jest
        .fn()
        .mockResolvedValueOnce([]) // materializeUpTo existing keys
        .mockResolvedValue([
          { id: 'p1', referenceMonth: '2026-04-01', amount: 700, dueDate: '2026-04-10', status: 'PENDING' },
        ]),
    });
    const service = makeService(repo, residentRepo);

    await service.recalcFuturePending('res-1');

    const repriced = repo.save.mock.calls.at(-1)![0] as Array<{ amount: number; familyInvestment: string }>;
    expect(repriced[0].amount).toBe(420);
    expect(repriced[0].familyInvestment).toBe('NEGOTIATED');
  });
});

describe('ResidentReceivableService.markImportedPayments', () => {
  it('marca parcela PENDING existente como PAID preservando valor/plano da parcela', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'rcv-1', referenceMonth: '2026-01-01', status: 'PENDING', amount: 700, familyInvestment: 'PAYMENT_700' },
      ]),
    });
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    const result = await service.markImportedPayments('res-1', ['2026-01-01']);

    expect(result).toEqual({ paid: 1, skipped: 0 });
    expect(repo.update).toHaveBeenCalledWith(
      'rcv-1',
      expect.objectContaining({
        status: 'PAID',
        paidAt: '2026-01-15',
        paidAmount: 700,
        paidFamilyInvestment: 'PAYMENT_700',
      }),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('competência sem parcela é criada já paga (mandatory dentro da janela de 6 meses)', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    const result = await service.markImportedPayments('res-1', ['2026-02-01']);

    expect(result).toEqual({ paid: 1, skipped: 0 });
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save.mock.calls[0][0]).toMatchObject({
      residentId: 'res-1',
      referenceMonth: '2026-02-01',
      status: 'PAID',
      amount: 700,
      paidAmount: 700,
      mandatory: true,
    });
  });

  it('competência anterior à entrada (acolhimento antigo) é criada paga e não-obrigatória', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    await service.markImportedPayments('res-1', ['2025-06-01']);

    expect(repo.save.mock.calls[0][0]).toMatchObject({
      referenceMonth: '2025-06-01',
      status: 'PAID',
      mandatory: false,
    });
  });

  it('parcela já PAID é preservada (skipped)', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'rcv-1', referenceMonth: '2026-01-01', status: 'PAID', amount: 700, familyInvestment: 'PAYMENT_700' },
      ]),
    });
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    const result = await service.markImportedPayments('res-1', ['2026-01-01']);

    expect(result).toEqual({ paid: 0, skipped: 1 });
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('sem meses → noop (nem consulta o resident)', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn() };
    const service = makeService(repo, residentRepo);

    const result = await service.markImportedPayments('res-1', []);

    expect(result).toEqual({ paid: 0, skipped: 0 });
    expect(residentRepo.findOne).not.toHaveBeenCalled();
  });

  it('meses duplicados no payload viram uma única parcela', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo);

    const result = await service.markImportedPayments('res-1', ['2026-02-01', '2026-02-01']);

    expect(result).toEqual({ paid: 1, skipped: 0 });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Story 164 — vínculo parcela → acolhimento
// ═════════════════════════════════════════════════════════════════════════════

// Retrato do caso base (Marcelo, conferido em produção): acolhimento 1 entrou em
// ago/2025 com saída gravada ANTES da entrada (dado ruim da planilha) e o
// acolhimento 2, atual, entrou em jul/2026.
const ADMISSION_OLD = {
  id: 'adm-1',
  entryDate: '2025-08-01',
  exitDate: '2025-02-10',
  createdAt: new Date('2026-07-10T00:00:00Z'),
};
const ADMISSION_CURRENT = {
  id: 'adm-2',
  entryDate: '2026-07-17',
  exitDate: null,
  createdAt: new Date('2026-07-20T00:00:00Z'),
};

describe('ResidentReceivableService.resolveAdmissionId', () => {
  it('resolve a competência pelo acolhimento dono da janela', async () => {
    const admissionRepo = makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never);
    const service = makeService(makeRepo(), {}, admissionRepo);

    await expect(service.resolveAdmissionId('res-1', '2025-09-01')).resolves.toBe('adm-1');
    await expect(service.resolveAdmissionId('res-1', '2026-08-01')).resolves.toBe('adm-2');
  });

  it('filho sem acolhimento → null (parcela órfã, decisão 7)', async () => {
    const service = makeService(makeRepo(), {}, makeAdmissionRepo([]));
    await expect(service.resolveAdmissionId('res-1', '2026-08-01')).resolves.toBeNull();
  });

  it('consulta apenas as admissões do filho (soft delete filtrado pelo TypeORM)', async () => {
    const admissionRepo = makeAdmissionRepo([ADMISSION_CURRENT] as never);
    const service = makeService(makeRepo(), {}, admissionRepo);

    await service.resolveAdmissionId('res-1', '2026-08-01');

    expect(admissionRepo.find).toHaveBeenCalledWith({ where: { residentId: 'res-1' } });
  });
});

describe('ResidentReceivableService — parcela nova nasce vinculada', () => {
  it('generateSchedule vincula as parcelas ao acolhimento atual', async () => {
    const repo = makeRepo();
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(makeResident({ entryDate: '2026-07-17' as never })),
    };
    const service = makeService(
      repo,
      residentRepo,
      makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never),
    );

    await service.generateSchedule('res-1');

    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved).toHaveLength(6);
    expect(saved.every((r) => r.admissionId === 'adm-2')).toBe(true);
  });

  it('parcela de filho sem acolhimento nasce com admissionId null', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(repo, residentRepo, makeAdmissionRepo([]));

    await service.generateSchedule('res-1');

    const saved = repo.save.mock.calls[0][0] as ResidentReceivable[];
    expect(saved.every((r) => r.admissionId === null)).toBe(true);
  });
});

describe('ResidentReceivableService.markImportedPayments — vínculo por competência', () => {
  it('competência antiga vai para o primeiro acolhimento e a recente para o atual', async () => {
    const repo = makeRepo();
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(makeResident({ entryDate: '2026-07-17' as never })),
    };
    const service = makeService(
      repo,
      residentRepo,
      makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never),
    );

    await service.markImportedPayments('res-1', ['2025-09-01', '2026-08-01']);

    const created = repo.save.mock.calls.map((c) => c[0] as ResidentReceivable);
    expect(created.find((r) => String(r.referenceMonth) === '2025-09-01')!.admissionId).toBe('adm-1');
    expect(created.find((r) => String(r.referenceMonth) === '2026-08-01')!.admissionId).toBe('adm-2');
  });

  it('carrega as admissões uma única vez para o lote de competências', async () => {
    const repo = makeRepo();
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const admissionRepo = makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never);
    const service = makeService(repo, residentRepo, admissionRepo);

    await service.markImportedPayments('res-1', ['2025-09-01', '2025-10-01', '2026-08-01']);

    expect(admissionRepo.find).toHaveBeenCalledTimes(1);
  });

  it('parcela existente sem vínculo recebe o acolhimento da competência', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'rcv-1', referenceMonth: '2025-09-01', status: 'PENDING', amount: 500, familyInvestment: 'BASKET_500', admissionId: null },
      ]),
    });
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(
      repo,
      residentRepo,
      makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never),
    );

    await service.markImportedPayments('res-1', ['2025-09-01']);

    expect(repo.update).toHaveBeenCalledWith('rcv-1', expect.objectContaining({ admissionId: 'adm-1' }));
  });

  it('parcela existente que JÁ tem vínculo não é sobrescrita', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'rcv-1', referenceMonth: '2025-09-01', status: 'PENDING', amount: 500, familyInvestment: 'BASKET_500', admissionId: 'adm-fixado' },
      ]),
    });
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident()) };
    const service = makeService(
      repo,
      residentRepo,
      makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never),
    );

    await service.markImportedPayments('res-1', ['2025-09-01']);

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('admissionId');
  });
});

describe('ResidentReceivableService — ajustes automáticos não tocam acolhimento encerrado', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-10T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  const pendings = [
    { id: 'antiga', referenceMonth: '2026-09-01', status: 'PENDING', admissionId: 'adm-1', amount: 500, dueDate: '2026-09-10' },
    { id: 'atual', referenceMonth: '2026-09-01', status: 'PENDING', admissionId: 'adm-2', amount: 500, dueDate: '2026-09-10' },
    { id: 'orfa', referenceMonth: '2026-09-01', status: 'PENDING', admissionId: null, amount: 500, dueDate: '2026-09-10' },
  ];

  function serviceWithPendings(residentOverrides = {}) {
    const repo = makeRepo({ find: jest.fn().mockResolvedValue(pendings) });
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(makeResident({ entryDate: '2026-07-17' as never, ...residentOverrides })),
    };
    const service = makeService(
      repo,
      residentRepo,
      makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never),
    );
    return { repo, service };
  }

  it('cancelFuturePending poupa a parcela do acolhimento anterior', async () => {
    const { repo, service } = serviceWithPendings();

    await service.cancelFuturePending('res-1');

    expect(repo.update.mock.calls[0][0].id._value).toEqual(['atual', 'orfa']);
  });

  it('cancelAfterExit poupa a parcela do acolhimento anterior', async () => {
    const { repo, service } = serviceWithPendings();

    await service.cancelAfterExit('res-1', '2026-08-20');

    expect(repo.update.mock.calls[0][0].id._value).toEqual(['atual', 'orfa']);
  });

  it('recalcFuturePending reprecifica só o acolhimento atual e as órfãs', async () => {
    const { repo, service } = serviceWithPendings({
      familyInvestment: 'NEGOTIATED' as never,
      familyInvestmentAmount: 420,
    });

    await service.recalcFuturePending('res-1');

    const repriced = repo.save.mock.calls.at(-1)![0] as Array<{ id: string }>;
    expect(repriced.map((r) => r.id)).toEqual(['atual', 'orfa']);
  });
});

describe('ResidentReceivableService.getLastPaidDates', () => {
  it('lista vazia não consulta o banco', async () => {
    const repo = makeRepo();
    const service = makeService(repo, {});
    await expect(service.getLastPaidDates([])).resolves.toEqual(new Map());
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('devolve a última competência paga por filho', async () => {
    const qb: Record<string, jest.Mock> = {};
    ['select', 'addSelect', 'where', 'andWhere', 'groupBy'].forEach((m) => {
      qb[m] = jest.fn(() => qb);
    });
    qb.getRawMany = jest.fn().mockResolvedValue([
      { residentId: 'res-1', lastMonth: '2026-03-01T00:00:00.000Z' },
    ]);
    const service = makeService(makeRepo({ createQueryBuilder: jest.fn(() => qb) }), {});

    const result = await service.getLastPaidDates(['res-1']);

    expect(result.get('res-1')).toBe('2026-03-01');
  });
});

describe('ResidentReceivableService.findByResident — story 164', () => {
  it('filho inexistente → NotFound', async () => {
    const service = makeService(makeRepo(), { findOne: jest.fn().mockResolvedValue(null) });
    await expect(service.findByResident('res-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filho ativo rola o carnê antes de listar', async () => {
    const qb: Record<string, jest.Mock> = {};
    ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy'].forEach((m) => {
      qb[m] = jest.fn(() => qb);
    });
    qb.getMany = jest.fn().mockResolvedValue([]);
    const repo = makeRepo({ createQueryBuilder: jest.fn(() => qb) });
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(makeResident({ status: 'ACTIVE' as never })),
    };
    const service = makeService(repo, residentRepo);
    const ensureSpy = jest.spyOn(service, 'ensureFutureOpen').mockResolvedValue(undefined);

    await service.findByResident('res-1');

    expect(ensureSpy).toHaveBeenCalledTimes(1);
  });

  it('a view devolve admissionId', async () => {
    const items = [
      { id: 'rcv-1', residentId: 'res-1', admissionId: 'adm-1', referenceMonth: '2025-09-01', dueDate: '2025-09-10', amount: 500, familyInvestment: 'BASKET_500', paidAmount: null, paidFamilyInvestment: null, mandatory: true, status: 'PAID', paidAt: null, paymentMethod: null, attachmentUrl: null, notes: null, createdBy: null, createdAt: new Date() },
      { id: 'rcv-2', residentId: 'res-1', admissionId: null, referenceMonth: '2026-08-01', dueDate: '2026-08-10', amount: 500, familyInvestment: 'BASKET_500', paidAmount: null, paidFamilyInvestment: null, mandatory: false, status: 'PENDING', paidAt: null, paymentMethod: null, attachmentUrl: null, notes: null, createdBy: null, createdAt: new Date() },
    ];
    const qb: Record<string, jest.Mock> = {};
    ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy'].forEach((m) => {
      qb[m] = jest.fn(() => qb);
    });
    qb.getMany = jest.fn().mockResolvedValue(items);
    const repo = makeRepo({ createQueryBuilder: jest.fn(() => qb) });
    // Status inativo evita o ensureFutureOpen e mantém o teste na leitura.
    const residentRepo = { findOne: jest.fn().mockResolvedValue(makeResident({ status: 'DISCHARGED' as never })) };
    const service = makeService(repo, residentRepo);

    const view = await service.findByResident('res-1');

    expect(view.map((v) => v.admissionId)).toEqual(['adm-1', null]);
    expect(qb.orderBy).toHaveBeenCalledWith('rcv.reference_month', 'ASC');
  });
});

describe('ResidentReceivableService — cenário Marcelo ponta a ponta', () => {
  it('as 6 competências de ago/25→jan/26 ficam no acolhimento 1 e nenhuma no atual', async () => {
    const repo = makeRepo();
    // Sem plano no acolhimento atual (familyInvestment null no Resident): o carnê
    // do acolhimento 2 nasce vazio — é exatamente o que a UI precisa sinalizar.
    const residentRepo = {
      findOne: jest.fn().mockResolvedValue(
        makeResident({ entryDate: '2026-07-17' as never, familyInvestment: null }),
      ),
    };
    const service = makeService(
      repo,
      residentRepo,
      makeAdmissionRepo([ADMISSION_OLD, ADMISSION_CURRENT] as never),
    );

    const months = ['2025-08-01', '2025-09-01', '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01'];
    const result = await service.markImportedPayments('res-1', months);

    expect(result).toEqual({ paid: 6, skipped: 0 });
    const created = repo.save.mock.calls.map((c) => c[0] as ResidentReceivable);
    expect(created).toHaveLength(6);
    expect(created.every((r) => r.admissionId === 'adm-1')).toBe(true);
    expect(created.some((r) => r.admissionId === 'adm-2')).toBe(false);

    // Sem plano, o acolhimento atual não materializa nada.
    repo.save.mockClear();
    await service.generateSchedule('res-1');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
