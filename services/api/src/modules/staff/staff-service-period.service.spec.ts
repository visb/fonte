// Story 216 — períodos de serviço da aba Histórico do servo. AuditService REAL
// sobre repositórios em memória: o evento sai do estado "persistido".
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditTargetType, SERVICE_PERIOD_MESSAGES } from '@fonte/types';
import { StaffServicePeriodService, openServicePeriod } from './staff-service-period.service';
import { StaffServicePeriod } from './staff-service-period.entity';
import { createAuditHarness, memoryRepo, repoMap } from '../audit/testing/audit-harness.testkit-spec';

const S1 = 'staff-1';
const S2 = 'staff-2';
const H1 = 'house-1';
const H2 = 'house-2';
const OPEN = 'period-open';
const OLD = 'period-old';

type Row = Record<string, unknown>;

function setup(options: { periods?: Row[]; staff?: string[]; houses?: string[] } = {}) {
  const rows = options.periods ?? [
    { id: OPEN, staffId: S1, houseId: H1, startDate: '2024-01-10', endDate: null },
    { id: OLD, staffId: S1, houseId: H1, startDate: '2020-01-01', endDate: '2020-06-30' },
    { id: 'period-other', staffId: S2, houseId: H2, startDate: '2019-01-01', endDate: null },
  ];
  const base = memoryRepo(rows);
  const periods = {
    ...base,
    findOneOrFail: jest.fn(async (opts: { where: Row }) => {
      const row = await base.findOne(opts);
      if (!row) throw new Error('not found');
      return row;
    }),
  };
  const staff = options.staff ?? [S1, S2];
  const houses = options.houses ?? [H1, H2];
  const staffRepo = { exists: jest.fn(async (o: { where: { id: string } }) => staff.includes(o.where.id)) };
  const houseRepo = { exists: jest.fn(async (o: { where: { id: string } }) => houses.includes(o.where.id)) };
  const harness = createAuditHarness(repoMap([[StaffServicePeriod, periods]]));
  const service = new StaffServicePeriodService(
    periods as never,
    staffRepo as never,
    houseRepo as never,
    harness.audit,
  );
  return { service, periods, inserted: harness.inserted, harness };
}

async function expect400(promise: Promise<unknown>, message?: string) {
  await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  if (message) await expect(promise).rejects.toThrow(message);
}

const validCreate = { houseId: H2, startDate: '2021-03-01', endDate: '2021-09-01' };

describe('StaffServicePeriodService.findServicePeriods', () => {
  it('lista os períodos do staff, início desc, com a casa', async () => {
    const { service, periods } = setup();
    const result = await service.findServicePeriods(S1);
    expect(periods.find).toHaveBeenCalledWith({
      where: { staffId: S1 },
      relations: { house: true },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining([OPEN, OLD]));
    expect(result).toHaveLength(2);
  });

  it('staff inexistente → 404', async () => {
    const { service } = setup();
    await expect(service.findServicePeriods('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StaffServicePeriodService.createServicePeriod', () => {
  it('cria período encerrado válido e audita com o servo como principal', async () => {
    const { service, inserted } = setup();
    const saved = await service.createServicePeriod(S1, validCreate);
    expect(saved).toMatchObject({ staffId: S1, houseId: H2, startDate: '2021-03-01', endDate: '2021-09-01' });
    expect(inserted).toEqual([
      expect.objectContaining({
        action: AuditAction.STAFF_SERVICE_PERIOD_CREATE,
        targetType: AuditTargetType.STAFF_SERVICE_PERIOD,
        targetId: saved.id,
        parentType: AuditTargetType.STAFF,
        parentId: S1,
        houseId: H2,
      }),
    ]);
  });

  it('sem casa é aceito (servo sem casa)', async () => {
    const { service } = setup();
    await expect(service.createServicePeriod(S1, { ...validCreate, houseId: null })).resolves.toMatchObject({
      houseId: null,
    });
  });

  it('sem fim → 400; com período aberto existente a mensagem é "já em andamento"', async () => {
    const { service } = setup();
    await expect400(
      service.createServicePeriod(S1, { startDate: '2021-01-01' }),
      SERVICE_PERIOD_MESSAGES.alreadyOpen,
    );
    const noOpen = setup({ periods: [] });
    await expect400(
      noOpen.service.createServicePeriod(S1, { startDate: '2021-01-01' }),
      SERVICE_PERIOD_MESSAGES.endDateRequired,
    );
  });

  it('datas futuras e fim < início → 400', async () => {
    const { service } = setup();
    await expect400(
      service.createServicePeriod(S1, { startDate: '2999-01-01', endDate: '2999-02-01' }),
      SERVICE_PERIOD_MESSAGES.startFuture,
    );
    await expect400(
      service.createServicePeriod(S1, { startDate: '2021-01-01', endDate: '2999-02-01' }),
      SERVICE_PERIOD_MESSAGES.endFuture,
    );
    await expect400(
      service.createServicePeriod(S1, { startDate: '2021-06-01', endDate: '2021-01-01' }),
      SERVICE_PERIOD_MESSAGES.endBeforeStart('2021-06-01'),
    );
  });

  it('sobreposição com período encerrado ou com o aberto → 400', async () => {
    const { service } = setup();
    await expect400(
      service.createServicePeriod(S1, { startDate: '2020-05-01', endDate: '2020-12-01' }),
      SERVICE_PERIOD_MESSAGES.overlap('2020-01-01', '2020-06-30'),
    );
    await expect400(
      service.createServicePeriod(S1, { startDate: '2024-02-01', endDate: '2024-03-01' }),
      SERVICE_PERIOD_MESSAGES.overlap('2024-01-10', null),
    );
  });

  it('encostar nas pontas não é sobreposição', async () => {
    const { service } = setup();
    await expect(
      service.createServicePeriod(S1, { startDate: '2020-06-30', endDate: '2024-01-10' }),
    ).resolves.toMatchObject({ startDate: '2020-06-30' });
  });

  it('casa inexistente → 400; staff inexistente → 404', async () => {
    const { service } = setup();
    await expect400(service.createServicePeriod(S1, { ...validCreate, houseId: 'ghost' }), 'Casa não encontrada.');
    await expect(service.createServicePeriod('nope', validCreate)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('violação do índice de período aberto vira 400 amigável; outros erros propagam', async () => {
    const { service, harness } = setup();
    const transaction = harness.dataSource.transaction as jest.Mock;
    transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    await expect400(service.createServicePeriod(S1, validCreate), SERVICE_PERIOD_MESSAGES.alreadyOpen);
    transaction.mockRejectedValueOnce(new Error('down'));
    await expect(service.createServicePeriod(S1, validCreate)).rejects.toThrow('down');
  });
});

describe('StaffServicePeriodService.updateServicePeriod — período encerrado', () => {
  it('edita início, fim e casa com auditoria', async () => {
    const { service, inserted } = setup();
    const updated = await service.updateServicePeriod(S1, OLD, {
      houseId: H2,
      startDate: '2019-12-01',
      endDate: '2020-07-15',
    });
    expect(updated).toMatchObject({ houseId: H2, startDate: '2019-12-01', endDate: '2020-07-15' });
    expect(inserted).toEqual([
      expect.objectContaining({
        action: AuditAction.STAFF_SERVICE_PERIOD_UPDATE,
        targetId: OLD,
        parentId: S1,
        houseId: H2,
        previousHouseId: H1,
      }),
    ]);
  });

  it('fim que invade o aberto → 400; fim antes do início → 400', async () => {
    const { service } = setup();
    await expect400(
      service.updateServicePeriod(S1, OLD, { endDate: '2024-02-01' }),
      SERVICE_PERIOD_MESSAGES.overlap('2024-01-10', null),
    );
    await expect400(
      service.updateServicePeriod(S1, OLD, { endDate: '2019-01-01' }),
      SERVICE_PERIOD_MESSAGES.endBeforeStart('2020-01-01'),
    );
  });

  it('casa inexistente → 400; casa nula é aceita', async () => {
    const { service } = setup();
    await expect400(service.updateServicePeriod(S1, OLD, { houseId: 'ghost' }), 'Casa não encontrada.');
    await expect(service.updateServicePeriod(S1, OLD, { houseId: null })).resolves.toMatchObject({ houseId: null });
  });

  it('payload sem mudança não grava nem audita', async () => {
    const { service, inserted, periods } = setup();
    await expect(service.updateServicePeriod(S1, OLD, { startDate: '2020-01-01' })).resolves.toMatchObject({ id: OLD });
    expect(periods.update).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });
});

describe('StaffServicePeriodService.updateServicePeriod — período aberto', () => {
  it('corrige só o início', async () => {
    const { service } = setup();
    await expect(service.updateServicePeriod(S1, OPEN, { startDate: '2023-12-01' })).resolves.toMatchObject({
      startDate: '2023-12-01',
      endDate: null,
    });
  });

  it('fim ou casa no aberto → 400', async () => {
    const { service } = setup();
    await expect400(
      service.updateServicePeriod(S1, OPEN, { endDate: '2024-05-01' }),
      SERVICE_PERIOD_MESSAGES.openOnlyStartDate,
    );
    await expect400(
      service.updateServicePeriod(S1, OPEN, { houseId: H2 }),
      SERVICE_PERIOD_MESSAGES.openOnlyStartDate,
    );
  });

  it('início futuro ou que engole o encerrado → 400', async () => {
    const { service } = setup();
    await expect400(service.updateServicePeriod(S1, OPEN, { startDate: '2999-01-01' }), SERVICE_PERIOD_MESSAGES.startFuture);
    await expect400(
      service.updateServicePeriod(S1, OPEN, { startDate: '2020-03-01' }),
      SERVICE_PERIOD_MESSAGES.overlap('2020-01-01', '2020-06-30'),
    );
  });
});

describe('StaffServicePeriodService.updateServicePeriod — escopo', () => {
  it('período de outro staff → 404', async () => {
    const { service } = setup();
    await expect(service.updateServicePeriod(S1, 'period-other', { startDate: '2019-02-01' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('openServicePeriod', () => {
  it('grava período aberto pelo manager recebido', async () => {
    const repo = memoryRepo();
    const manager = { getRepository: jest.fn(() => repo) };
    const saved = await openServicePeriod(manager as never, { staffId: S1, houseId: null, startDate: '2026-01-01' });
    expect(manager.getRepository).toHaveBeenCalledWith(StaffServicePeriod);
    expect(saved).toMatchObject({ staffId: S1, houseId: null, startDate: '2026-01-01', endDate: null });
  });
});
