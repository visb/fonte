// Story 215 — criação e correção de passagens pela aba Histórico. AuditService
// REAL sobre repositórios em memória: o evento sai do estado "persistido".
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ADMISSION_DATE_MESSAGES,
  ADMISSION_HISTORY_MESSAGES,
  AuditAction,
  AuditTargetType,
  ResidentStatus,
} from '@fonte/types';
import { AdmissionService } from './admission.service';
import { Admission } from './admission.entity';
import { Resident } from './resident.entity';
import { createAuditHarness, memoryRepo, repoMap } from '../audit/testing/audit-harness.testkit-spec';

const R1 = '11111111-1111-4111-8111-111111111111';
const H1 = '22222222-2222-4222-8222-222222222222';
const H2 = '33333333-3333-4333-8333-333333333333';
const CURRENT = 'adm-current';
const OLD = 'adm-old';

type Row = Record<string, unknown>;

function setup(options: { admissions?: Row[]; resident?: Row; houses?: string[] } = {}) {
  const residentRow: Row = {
    id: R1,
    name: 'Ana',
    status: ResidentStatus.ACTIVE,
    houseId: H1,
    entryDate: '2024-01-10',
    exitDate: null,
    ...options.resident,
  };
  const residents = memoryRepo([residentRow]);
  const admissionRows = options.admissions ?? [
    { id: CURRENT, residentId: R1, houseId: H1, entryDate: '2024-01-10', exitDate: null, status: 'ACTIVE', createdAt: 2 },
    { id: OLD, residentId: R1, houseId: H1, entryDate: '2020-01-01', exitDate: '2020-06-30', status: 'DISCHARGED', createdAt: 1 },
  ];
  const base = memoryRepo(admissionRows);
  const admissions = {
    ...base,
    findOneOrFail: jest.fn(async (opts: { where: Row }) => {
      const row = await base.findOne(opts);
      if (!row) throw new Error('not found');
      return row;
    }),
  };
  const houses = options.houses ?? [H1, H2];
  const houseRepo = { exists: jest.fn(async (opts: { where: { id: string } }) => houses.includes(opts.where.id)) };
  const harness = createAuditHarness(repoMap([[Resident, residents], [Admission, admissions]]));

  // Mesma ordem de `ResidentService.findAdmissions`: maior entrada primeiro.
  const residentService = {
    findOne: jest.fn(async (id: string) => {
      const row = await residents.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`Resident ${id} not found`);
      return row;
    }),
    findAdmissions: jest.fn(async (residentId: string) =>
      [...admissions.table.values()]
        .filter((row) => row.residentId === residentId)
        .sort((a, b) => {
          const ea = (a.entryDate as string | null) ?? '';
          const eb = (b.entryDate as string | null) ?? '';
          if (ea !== eb) return ea < eb ? 1 : -1;
          return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0);
        })
        .map((row) => ({ ...row })),
    ),
  };
  const service = new AdmissionService(
    admissions as never,
    houseRepo as never,
    residentService as never,
    harness.audit,
  );
  return { service, residents, admissions, houseRepo, residentService, inserted: harness.inserted };
}

async function expect400(promise: Promise<unknown>, message?: string) {
  await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  if (message) await expect(promise).rejects.toThrow(message);
}

const validCreate = {
  houseId: H2,
  entryDate: '2021-03-01',
  exitDate: '2021-09-01',
  status: ResidentStatus.EVADED,
};

describe('AdmissionService.createAdmission', () => {
  it('salva passagem encerrada válida e audita com o filho como principal', async () => {
    const { service, admissions, inserted } = setup();
    const saved = await service.createAdmission(R1, validCreate);
    expect(saved).toMatchObject({ residentId: R1, houseId: H2, entryDate: '2021-03-01', status: 'EVADED' });
    expect(admissions.table.size).toBe(3);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      action: AuditAction.ADMISSION_CREATE,
      targetType: AuditTargetType.ADMISSION,
      targetId: saved.id,
      parentType: AuditTargetType.RESIDENT,
      parentId: R1,
      houseId: H2,
    });
  });

  it('sem saída → 400', async () => {
    const { service } = setup();
    await expect400(
      service.createAdmission(R1, { ...validCreate, exitDate: undefined as never }),
      ADMISSION_HISTORY_MESSAGES.exitDateRequired,
    );
  });

  it('entrada futura, saída futura e saída < entrada → 400 com as mensagens da 203', async () => {
    const { service } = setup();
    await expect400(
      service.createAdmission(R1, { ...validCreate, entryDate: '2999-01-01', exitDate: '2999-02-01' }),
      ADMISSION_DATE_MESSAGES.entryFuture,
    );
    await expect400(
      service.createAdmission(R1, { ...validCreate, exitDate: '2999-02-01' }),
      ADMISSION_DATE_MESSAGES.exitFuture,
    );
    await expect400(
      service.createAdmission(R1, { ...validCreate, exitDate: '2021-01-01' }),
      ADMISSION_DATE_MESSAGES.exitBeforeEntry('2021-03-01'),
    );
  });

  it('sobreposição com passagem existente → 400', async () => {
    const { service } = setup();
    await expect400(
      service.createAdmission(R1, { ...validCreate, entryDate: '2020-05-01', exitDate: '2020-12-01' }),
      ADMISSION_HISTORY_MESSAGES.overlap('2020-01-01', '2020-06-30'),
    );
  });

  it('encostar na saída de outra passagem não é sobreposição', async () => {
    const { service } = setup();
    await expect(
      service.createAdmission(R1, { ...validCreate, entryDate: '2020-06-30', exitDate: '2020-08-01' }),
    ).resolves.toMatchObject({ entryDate: '2020-06-30' });
  });

  it('passagem que começa depois do atual → 400 (viraria o "atual")', async () => {
    const { service } = setup({
      resident: { status: ResidentStatus.DISCHARGED, exitDate: '2024-05-01' },
      admissions: [
        { id: CURRENT, residentId: R1, houseId: H1, entryDate: '2024-01-10', exitDate: '2024-05-01', status: 'DISCHARGED' },
      ],
    });
    await expect400(
      service.createAdmission(R1, { ...validCreate, entryDate: '2024-06-01', exitDate: '2024-07-01' }),
      ADMISSION_HISTORY_MESSAGES.afterCurrent('2024-01-10'),
    );
  });

  it('sem admissão nenhuma, compara com a entrada da ficha', async () => {
    const { service } = setup({ admissions: [] });
    await expect400(
      service.createAdmission(R1, { ...validCreate, entryDate: '2024-02-01', exitDate: '2024-03-01' }),
      ADMISSION_HISTORY_MESSAGES.afterCurrent('2024-01-10'),
    );
    await expect(service.createAdmission(R1, validCreate)).resolves.toMatchObject({ status: 'EVADED' });
  });

  it('casa nula com status ≠ ARCHIVED → 400; com ARCHIVED passa', async () => {
    const { service } = setup();
    await expect400(
      service.createAdmission(R1, { ...validCreate, houseId: null }),
      ADMISSION_HISTORY_MESSAGES.houseRequired,
    );
    await expect(
      service.createAdmission(R1, { ...validCreate, houseId: null, status: ResidentStatus.ARCHIVED }),
    ).resolves.toMatchObject({ houseId: null, status: 'ARCHIVED' });
  });

  it('casa inexistente → 400', async () => {
    const { service } = setup({ houses: [H1] });
    await expect400(service.createAdmission(R1, validCreate), 'Casa não encontrada.');
  });

  it('status não terminal → 400', async () => {
    const { service } = setup();
    await expect400(
      service.createAdmission(R1, { ...validCreate, status: ResidentStatus.ACTIVE }),
      ADMISSION_HISTORY_MESSAGES.exitStatusRequired,
    );
  });

  it('filho inexistente → 404', async () => {
    const { service } = setup();
    await expect(service.createAdmission('nope', validCreate)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdmissionService.updateAdmission — passagem encerrada', () => {
  it('muda casa, datas e status e audita', async () => {
    const { service, inserted } = setup();
    const updated = await service.updateAdmission(R1, OLD, {
      houseId: H2,
      entryDate: '2019-12-01',
      exitDate: '2020-07-15',
      status: ResidentStatus.EVADED,
    });
    expect(updated).toMatchObject({ houseId: H2, entryDate: '2019-12-01', exitDate: '2020-07-15', status: 'EVADED' });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      action: AuditAction.ADMISSION_UPDATE,
      targetType: AuditTargetType.ADMISSION,
      targetId: OLD,
      parentId: R1,
      houseId: H2,
      previousHouseId: H1,
    });
  });

  it('a própria passagem não conta como sobreposição', async () => {
    const { service } = setup();
    await expect(service.updateAdmission(R1, OLD, { exitDate: '2020-06-01' })).resolves.toMatchObject({
      exitDate: '2020-06-01',
    });
  });

  it('sobreposição com outra passagem → 400', async () => {
    const { service } = setup();
    await expect400(
      service.updateAdmission(R1, OLD, { exitDate: '2024-02-01' }),
      ADMISSION_HISTORY_MESSAGES.overlap('2024-01-10', null),
    );
  });

  it('entrada depois do atual → 400', async () => {
    const { service } = setup({
      resident: { status: ResidentStatus.DISCHARGED, exitDate: '2024-05-01' },
      admissions: [
        { id: CURRENT, residentId: R1, houseId: H1, entryDate: '2024-01-10', exitDate: '2024-05-01', status: 'DISCHARGED' },
        { id: OLD, residentId: R1, houseId: H1, entryDate: '2020-01-01', exitDate: '2020-06-30', status: 'DISCHARGED' },
      ],
    });
    await expect400(
      service.updateAdmission(R1, OLD, { entryDate: '2024-06-01', exitDate: '2024-07-01' }),
      ADMISSION_HISTORY_MESSAGES.afterCurrent('2024-01-10'),
    );
  });

  it('status não terminal → 400; casa nula sem ARCHIVED → 400', async () => {
    const { service } = setup();
    await expect400(
      service.updateAdmission(R1, OLD, { status: ResidentStatus.ACTIVE }),
      ADMISSION_HISTORY_MESSAGES.exitStatusRequired,
    );
    await expect400(service.updateAdmission(R1, OLD, { houseId: null }), ADMISSION_HISTORY_MESSAGES.houseRequired);
    await expect(
      service.updateAdmission(R1, OLD, { houseId: null, status: ResidentStatus.ARCHIVED }),
    ).resolves.toMatchObject({ houseId: null, status: 'ARCHIVED' });
  });

  it('só status, mantendo a casa gravada, não revalida a casa', async () => {
    const { service, houseRepo } = setup();
    await service.updateAdmission(R1, OLD, { status: ResidentStatus.EVADED });
    expect(houseRepo.exists).not.toHaveBeenCalled();
  });

  it('datas inválidas → 400 com as mensagens da 203', async () => {
    const { service } = setup();
    await expect400(
      service.updateAdmission(R1, OLD, { exitDate: '2019-01-01' }),
      ADMISSION_DATE_MESSAGES.exitBeforeEntry('2020-01-01'),
    );
  });

  it('payload vazio não grava nem audita', async () => {
    const { service, inserted } = setup();
    await expect(service.updateAdmission(R1, OLD, {})).resolves.toMatchObject({ id: OLD });
    expect(inserted).toHaveLength(0);
  });
});

describe('AdmissionService.updateAdmission — acolhimento atual', () => {
  it('só entryDate: atualiza a passagem e resident.entry_date, auditando os dois', async () => {
    const { service, residents, inserted } = setup();
    const updated = await service.updateAdmission(R1, CURRENT, { entryDate: '2024-01-05' });
    expect(updated).toMatchObject({ entryDate: '2024-01-05' });
    expect(residents.table.get(R1)).toMatchObject({ entryDate: '2024-01-05' });
    expect(inserted.map((row) => row.targetType)).toEqual(
      expect.arrayContaining([AuditTargetType.ADMISSION, AuditTargetType.RESIDENT]),
    );
    expect(inserted.every((row) => row.action === AuditAction.ADMISSION_UPDATE)).toBe(true);
  });

  it.each([
    [{ houseId: H2 }],
    [{ exitDate: '2024-05-01' }],
    [{ status: ResidentStatus.DISCHARGED }],
    [{ entryDate: '2024-01-05', status: ResidentStatus.EVADED }],
  ])('outro campo (%j) → 400', async (dto) => {
    const { service } = setup();
    await expect400(service.updateAdmission(R1, CURRENT, dto), ADMISSION_HISTORY_MESSAGES.currentOnlyEntryDate);
  });

  it('entrada futura → 400; sobreposição com passagem anterior → 400', async () => {
    const { service } = setup();
    await expect400(
      service.updateAdmission(R1, CURRENT, { entryDate: '2999-01-01' }),
      ADMISSION_DATE_MESSAGES.entryFuture,
    );
    await expect400(
      service.updateAdmission(R1, CURRENT, { entryDate: '2020-03-01' }),
      ADMISSION_HISTORY_MESSAGES.overlap('2020-01-01', '2020-06-30'),
    );
  });

  it('sem campo nenhum devolve a passagem sem gravar', async () => {
    const { service, inserted } = setup();
    await expect(service.updateAdmission(R1, CURRENT, {})).resolves.toMatchObject({ id: CURRENT });
    expect(inserted).toHaveLength(0);
  });
});

describe('AdmissionService.updateAdmission — escopo', () => {
  it('admission de outro filho → 404', async () => {
    const { service } = setup({
      admissions: [
        { id: CURRENT, residentId: R1, houseId: H1, entryDate: '2024-01-10', exitDate: null, status: 'ACTIVE' },
        { id: 'adm-other', residentId: 'other', houseId: H1, entryDate: '2020-01-01', exitDate: '2020-02-01', status: 'DISCHARGED' },
      ],
    });
    await expect(service.updateAdmission(R1, 'adm-other', { status: ResidentStatus.EVADED })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
