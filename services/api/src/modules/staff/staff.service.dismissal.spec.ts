import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AuditAction,
  STAFF_DISMISSAL_MESSAGES,
  StaffDismissalReason,
  todayInSaoPaulo,
} from '@fonte/types';
import { StaffService } from './staff.service';
import { Staff } from './staff.entity';
import { StaffServicePeriod } from './staff-service-period.entity';
import { House } from '../house/house.entity';
import { AuditService } from '../audit/audit.service';
import { AuditLog } from '../audit/audit-log.entity';

/**
 * Story 217 — desligamento e reintegração do servo. O EntityManager mockado é o
 * da transação do AuditService: tudo que o service escreve passa por ele, então
 * uma falha no meio propaga e (no banco real) desfaz a transação inteira.
 */
function setup(options: {
  staff?: Record<string, unknown>;
  openPeriod?: Record<string, unknown> | null;
  periods?: Array<Record<string, unknown>>;
  houseExists?: boolean;
  failOn?: 'ministries';
} = {}) {
  // Mocks com estado: o AuditService só grava evento quando antes ≠ depois.
  const staff: Record<string, unknown> = {
    id: 'staff-1',
    userId: 'user-1',
    houseId: 'house-1',
    dismissedAt: null,
    ...options.staff,
  };
  const user: Record<string, unknown> = { id: 'user-1', isActive: !staff.dismissedAt };
  const rows = [...(options.periods ?? []), ...(options.openPeriod ? [options.openPeriod] : [])].map((p) => ({
    ...p,
  }));
  const patch = (target: Record<string, unknown>) =>
    jest.fn(async (_id: string, values: Record<string, unknown>) => {
      Object.assign(target, values);
      return { affected: 1 };
    });
  const staffRepo = {
    findOne: jest.fn(async () => ({ ...staff })),
    update: patch(staff),
  };
  const userRepo = {
    findOne: jest.fn(async () => ({ ...user })),
    update: patch(user),
  };
  const periodRepo = {
    findOne: jest.fn(async ({ where }: { where: { id?: string } }) => {
      const row = where.id ? rows.find((p) => p.id === where.id) : options.openPeriod && rows[rows.length - 1];
      return row ? { ...row } : null;
    }),
    find: jest.fn(async () => rows.map((p) => ({ ...p }))),
    update: jest.fn(async (id: string, values: Record<string, unknown>) => {
      Object.assign(rows.find((p) => p.id === id)!, values);
      return { affected: 1 };
    }),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'period-new', ...v })),
  };
  const auditInsert = jest.fn().mockResolvedValue(undefined);
  const houseUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (options.failOn === 'ministries' && sql.includes('UPDATE ministries')) throw new Error('boom');
    return [];
  });
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === AuditLog) return { insert: auditInsert };
      if (entity === StaffServicePeriod) return periodRepo;
      if (entity === Staff) return staffRepo;
      return userRepo;
    },
    count: jest.fn(async (entity: unknown) => {
      if (entity === House) return options.houseExists === false ? 0 : 1;
      return 1;
    }),
    update: houseUpdate,
    query,
  };
  const transaction = jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(manager));
  Object.assign(staffRepo, { manager: { transaction } });
  const audit = new AuditService({} as never, { transaction, query: jest.fn() } as never);
  const service = new StaffService(
    staffRepo as never,
    userRepo as never,
    {} as never,
    {} as never,
    audit,
  );
  const actions = () => auditInsert.mock.calls.map(([row]) => (row as { action: string }).action);
  return { service, staffRepo, userRepo, periodRepo, houseUpdate, query, transaction, actions };
}

const today = todayInSaoPaulo();

describe('StaffService.dismiss (story 217)', () => {
  const open = { id: 'period-1', staffId: 'staff-1', startDate: '2020-01-01', endDate: null };

  it('fecha o período aberto, grava dismissed_at, desativa o User e limpa titular/liderança', async () => {
    const ctx = setup({ openPeriod: open });

    await ctx.service.dismiss('staff-1', {
      date: today,
      reason: StaffDismissalReason.OTHER,
      notes: '  mudou de cidade  ',
    });

    expect(ctx.transaction).toHaveBeenCalledTimes(1);
    expect(ctx.periodRepo.update).toHaveBeenCalledWith('period-1', {
      endDate: today,
      endReason: StaffDismissalReason.OTHER,
      endNotes: 'mudou de cidade',
    });
    expect(ctx.staffRepo.update).toHaveBeenCalledWith('staff-1', { dismissedAt: today });
    expect(ctx.userRepo.update).toHaveBeenCalledWith('user-1', { isActive: false });
    expect(ctx.houseUpdate).toHaveBeenCalledWith(House, { coordinatorId: 'staff-1' }, { coordinatorId: null });
    const ministry = ctx.query.mock.calls.find(([sql]) => sql.includes('UPDATE ministries'))!;
    expect(ministry[0]).toContain("leader_type = 'STAFF' AND leader_id = $1");
    expect(ministry[1]).toEqual(['staff-1']);
    expect(ctx.actions()).toEqual([AuditAction.STAFF_SERVICE_PERIOD_UPDATE, AuditAction.STAFF_DISMISS]);
  });

  it('sem soft delete: o User não é removido', async () => {
    const ctx = setup({ openPeriod: open });
    Object.assign(ctx.userRepo, { softDelete: jest.fn() });
    Object.assign(ctx.staffRepo, { softDelete: jest.fn() });

    await ctx.service.dismiss('staff-1', { date: today, reason: StaffDismissalReason.OWN_REQUEST });

    expect((ctx.userRepo as unknown as { softDelete: jest.Mock }).softDelete).not.toHaveBeenCalled();
    expect((ctx.staffRepo as unknown as { softDelete: jest.Mock }).softDelete).not.toHaveBeenCalled();
    expect(ctx.periodRepo.update).toHaveBeenCalledWith('period-1', expect.objectContaining({ endNotes: null }));
  });

  it('sem período aberto (legado) só grava o desligamento', async () => {
    const ctx = setup({ openPeriod: null });

    await ctx.service.dismiss('staff-1', { date: today, reason: StaffDismissalReason.DEATH });

    expect(ctx.periodRepo.update).not.toHaveBeenCalled();
    expect(ctx.staffRepo.update).toHaveBeenCalledWith('staff-1', { dismissedAt: today });
  });

  it('falha no meio propaga (transação desfeita)', async () => {
    const ctx = setup({ openPeriod: open, failOn: 'ministries' });

    await expect(
      ctx.service.dismiss('staff-1', { date: today, reason: StaffDismissalReason.OWN_REQUEST }),
    ).rejects.toThrow('boom');
  });

  it('data futura → 400', async () => {
    const ctx = setup({ openPeriod: open });
    await expect(
      ctx.service.dismiss('staff-1', { date: '2999-01-01', reason: StaffDismissalReason.OWN_REQUEST }),
    ).rejects.toThrow(new BadRequestException(STAFF_DISMISSAL_MESSAGES.dateFuture));
    expect(ctx.transaction).not.toHaveBeenCalled();
  });

  it('data anterior ao início do período aberto → 400, nada gravado', async () => {
    const ctx = setup({ openPeriod: { ...open, startDate: '2020-06-01' } });
    await expect(
      ctx.service.dismiss('staff-1', { date: '2020-05-31', reason: StaffDismissalReason.OWN_REQUEST }),
    ).rejects.toThrow(STAFF_DISMISSAL_MESSAGES.dateBeforeStart('2020-06-01'));
    expect(ctx.staffRepo.update).not.toHaveBeenCalled();
  });

  it('OTHER sem observação → 400', async () => {
    const ctx = setup({ openPeriod: open });
    await expect(
      ctx.service.dismiss('staff-1', { date: today, reason: StaffDismissalReason.OTHER, notes: '   ' }),
    ).rejects.toThrow(STAFF_DISMISSAL_MESSAGES.notesRequired);
  });

  it('já desligado → 409', async () => {
    const ctx = setup({ staff: { dismissedAt: '2021-01-01' } });
    await expect(
      ctx.service.dismiss('staff-1', { date: today, reason: StaffDismissalReason.OWN_REQUEST }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('StaffService.reinstate (story 217)', () => {
  const dismissed = { dismissedAt: '2021-03-01', houseId: 'house-1' };
  const closed = { id: 'period-1', startDate: '2020-01-01', endDate: '2021-03-01' };

  it('reativa o User, limpa dismissed_at e abre período novo na casa informada', async () => {
    const ctx = setup({ staff: dismissed, periods: [closed] });

    await ctx.service.reinstate('staff-1', { date: today, houseId: 'house-2' });

    expect(ctx.staffRepo.update).toHaveBeenCalledWith('staff-1', { dismissedAt: null, houseId: 'house-2' });
    expect(ctx.userRepo.update).toHaveBeenCalledWith('user-1', { isActive: true });
    expect(ctx.periodRepo.save).toHaveBeenCalledWith({
      staffId: 'staff-1',
      houseId: 'house-2',
      startDate: today,
      endDate: null,
    });
    expect(ctx.actions()).toEqual([AuditAction.STAFF_REINSTATE]);
  });

  it('sem houseId mantém a última casa; reintegrar no dia do fim é permitido', async () => {
    const ctx = setup({ staff: dismissed, periods: [closed] });

    await ctx.service.reinstate('staff-1', { date: '2021-03-01' });

    expect(ctx.periodRepo.save).toHaveBeenCalledWith(expect.objectContaining({ houseId: 'house-1' }));
  });

  it('houseId null reintegra sem casa', async () => {
    const ctx = setup({ staff: dismissed, periods: [closed] });

    await ctx.service.reinstate('staff-1', { date: today, houseId: null });

    expect(ctx.periodRepo.save).toHaveBeenCalledWith(expect.objectContaining({ houseId: null }));
  });

  it('fecha um período aberto residual antes de abrir o novo', async () => {
    const residual = { id: 'period-2', startDate: '2021-04-01', endDate: null };
    const ctx = setup({ staff: dismissed, periods: [closed, residual] });

    await ctx.service.reinstate('staff-1', { date: today });

    expect(ctx.periodRepo.update).toHaveBeenCalledWith('period-2', { endDate: today });
    expect(ctx.actions()).toEqual([AuditAction.STAFF_SERVICE_PERIOD_UPDATE, AuditAction.STAFF_REINSTATE]);
  });

  it('data antes do fim do último período → 400', async () => {
    const ctx = setup({ staff: dismissed, periods: [closed] });
    await expect(ctx.service.reinstate('staff-1', { date: '2021-02-28' })).rejects.toThrow(
      STAFF_DISMISSAL_MESSAGES.reinstateBeforeLastEnd('2021-03-01'),
    );
    expect(ctx.periodRepo.save).not.toHaveBeenCalled();
  });

  it('data futura → 400', async () => {
    const ctx = setup({ staff: dismissed });
    await expect(ctx.service.reinstate('staff-1', { date: '2999-01-01' })).rejects.toThrow(
      STAFF_DISMISSAL_MESSAGES.reinstateFuture,
    );
  });

  it('casa inexistente → 400', async () => {
    const ctx = setup({ staff: dismissed, houseExists: false });
    await expect(ctx.service.reinstate('staff-1', { date: today, houseId: 'nope' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('servo ativo → 409', async () => {
    const ctx = setup();
    await expect(ctx.service.reinstate('staff-1', { date: today })).rejects.toBeInstanceOf(ConflictException);
  });
});
