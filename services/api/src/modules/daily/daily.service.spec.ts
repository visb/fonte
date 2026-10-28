import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DAILY_SKIP_REASONS,
  DailyPersonType,
  DailySessionStatus,
  ServantRank,
  todayInSaoPaulo,
} from '@fonte/types';
import { DailyService, toPerson } from './daily.service';
import { DailyPersonRow } from './daily.repository';
import { DAILY_APPLIED_EVENT, DAILY_MOVED_EVENT, DAILY_RESET_EVENT } from './daily.events';

const R = DailyPersonType.RESIDENT;
const S = DailyPersonType.STAFF;

const coord = { userId: 'u-coord', role: 'COORDINATOR' };
const otherCoord = { userId: 'u-other', role: 'COORDINATOR' };
const admin = { userId: 'u-admin', role: 'ADMIN' };
const servant = { userId: 'u-servo', role: 'SERVANT' };

function person(type: DailyPersonType, id: string, name: string, ministryIds: string[] = [], extra: Partial<DailyPersonRow> = {}): DailyPersonRow {
  return { type, id, name, photoThumbUrl: null, rank: null, role: type === S ? 'SERVANT' : null, ministryIds, ...extra };
}

/** Repositório em memória: o service roda de verdade sobre ele. */
function makeFake() {
  let seq = 0;
  const state = {
    sessions: [] as Array<Record<string, any>>,
    assignments: [] as Array<Record<string, any>>,
    ministries: [
      { id: 'm1', name: 'Cozinha' },
      { id: 'm2', name: 'Horta' },
    ],
    people: [
      person(R, 'r1', 'Bruno', ['m1']),
      person(R, 'r2', 'Ana'),
      person(S, 's1', 'Carlos', ['m1', 'm2']),
      person(S, 'c1', 'Dora', [], { role: 'COORDINATOR' }),
      person(S, 's2', 'Eva', ['m2'], { rank: ServantRank.CONSAGRADO }),
    ],
    staffHouses: { 'u-coord': 'h1', 'u-other': 'h2', 'u-servo': 'h1' } as Record<string, string>,
    houseExists: true,
    names: { 'u-coord': 'Coord' } as Record<string, string>,
  };
  const session = (id: string) => state.sessions.find((s) => s.id === id) ?? null;
  const repo = {
    findSession: jest.fn(async (id: string) => session(id)),
    lockOpenSession: jest.fn(async (_m: unknown, houseId: string) =>
      state.sessions.find((s) => s.houseId === houseId && s.status === 'OPEN') ?? null),
    lockSession: jest.fn(async (_m: unknown, id: string) => session(id)),
    findAppliedOn: jest.fn(async (_m: unknown, houseId: string, date: string) =>
      state.sessions.filter((s) => s.houseId === houseId && s.status === 'APPLIED' && s.sessionDate === date).at(-1) ?? null),
    createSession: jest.fn(async (_m: unknown, data: Record<string, unknown>) => {
      const s = { id: `s-${++seq}`, appliedAt: null, appliedByUserId: null, ...data };
      state.sessions.push(s);
      return s;
    }),
    saveSession: jest.fn(async (_m: unknown, s: unknown) => s),
    bumpVersion: jest.fn(async (_m: unknown, id: string) => {
      const s = session(id)!;
      s.version += 1;
      return s.version;
    }),
    listAssignments: jest.fn(async (_m: unknown, sessionId: string) =>
      state.assignments.filter((a) => a.sessionId === sessionId).map((a) => ({ ...a }))),
    insertAssignments: jest.fn(async (_m: unknown, rows: Array<Record<string, unknown>>) => {
      rows.forEach((r) => state.assignments.push({ id: `a-${++seq}`, ...r }));
    }),
    deleteAssignments: jest.fn(async (_m: unknown, ids: string[]) => {
      state.assignments = state.assignments.filter((a) => !ids.includes(a.id));
    }),
    clearAssignmentMinistry: jest.fn(async (_m: unknown, ids: string[]) => {
      state.assignments.filter((a) => ids.includes(a.id)).forEach((a) => (a.ministryId = null));
    }),
    setAssignment: jest.fn(async (_m: unknown, sessionId: string, type: string, id: string, ministryId: string | null) => {
      const a = state.assignments.find((x) => x.sessionId === sessionId && x.personType === type && x.personId === id);
      if (!a) return false;
      a.ministryId = ministryId;
      return true;
    }),
    listMinistries: jest.fn(async () => state.ministries),
    isHouseMinistry: jest.fn(async (_m: unknown, id: string, houseId: string) =>
      houseId === 'h1' && state.ministries.some((mi) => mi.id === id)),
    listEligiblePeople: jest.fn(async () => state.people),
    userName: jest.fn(async (_m: unknown, uid: string | null) => (uid ? state.names[uid] ?? null : null)),
    staffHouseId: jest.fn(async (uid: string) => state.staffHouses[uid] ?? null),
    houseExists: jest.fn(async () => state.houseExists),
  };
  const manager = { tag: 'tx' };
  const dataSource = { transaction: jest.fn((work: (m: unknown) => unknown) => work(manager)) };
  const ministries = {
    setResidentMinistry: jest.fn().mockResolvedValue(true),
    setStaffMinistry: jest.fn().mockResolvedValue(true),
  };
  const events = { emit: jest.fn() };
  const service = new DailyService(repo as never, dataSource as never, ministries as never, events as never);
  return { service, repo, state, manager, dataSource, ministries, events };
}

const boxOf = (board: Awaited<ReturnType<DailyService['current']>>, id: string) => {
  if (board.unassigned.some((p) => p.id === id)) return null;
  return board.ministries.find((m) => m.members.some((p) => p.id === id))?.id;
};

describe('DailyService — acesso (decisão 3)', () => {
  it('SERVANT → 403 em todos', async () => {
    const { service } = makeFake();
    await expect(service.current(servant)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.start(servant)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.findSessionForUser(servant, 's-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.move(servant, 's-1', { personType: R, personId: 'r1', toMinistryId: null }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.apply(servant, 's-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('COORDINATOR de outra casa → 403; sem lotação → 403', async () => {
    const { service, state } = makeFake();
    await expect(service.current(coord, 'h2')).rejects.toBeInstanceOf(ForbiddenException);
    delete state.staffHouses['u-coord'];
    await expect(service.current(coord)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('COORDINATOR de outra casa não acessa a sessão (move/apply/join)', async () => {
    const { service } = makeFake();
    const board = await service.current(coord);
    await expect(service.findSessionForUser(otherCoord, board.session.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.apply(otherCoord, board.session.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ADMIN abre qualquer casa; sem houseId nem lotação → 400; casa inexistente → 404', async () => {
    const { service, state } = makeFake();
    const board = await service.current(admin, 'h1');
    expect(board.session.houseId).toBe('h1');
    await expect(service.findSessionForUser(admin, board.session.id)).resolves.toMatchObject({ id: board.session.id });
    await expect(service.current(admin)).rejects.toBeInstanceOf(BadRequestException);
    state.staffHouses['u-admin'] = 'h1';
    await expect(service.current(admin)).resolves.toMatchObject({ session: { houseId: 'h1' } });
    state.houseExists = false;
    await expect(service.current(admin, 'h9')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sessão inexistente → 404', async () => {
    const { service } = makeFake();
    await expect(service.findSessionForUser(coord, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DailyService.current — abertura e pré-preenchimento (decisões 4–6)', () => {
  it('sem sessão → cria OPEN do dia pré-preenchida com o estado real', async () => {
    const { service, state } = makeFake();
    const board = await service.current(coord);

    expect(board.session).toMatchObject({ status: 'OPEN', houseId: 'h1', version: 0, sessionDate: todayInSaoPaulo() });
    expect(state.sessions).toHaveLength(1);
    expect(boxOf(board, 'r1')).toBe('m1');
    expect(boxOf(board, 'r2')).toBeNull();
    // Servo em 2 ministérios entra no vínculo mais antigo e leva o aviso.
    expect(boxOf(board, 's1')).toBe('m1');
    expect(boxOf(board, 'c1')).toBeNull();
    expect(boxOf(board, 's2')).toBe('m2');

    const m1 = board.ministries.find((m) => m.id === 'm1')!;
    expect(m1.members.map((p) => p.name)).toEqual(['Bruno', 'Carlos']); // alfabética
    expect(board.unassigned.map((p) => p.name)).toEqual(['Ana', 'Dora']);
    expect(m1.members[1]).toMatchObject({ type: 'STAFF', hadMultipleMinistries: true, roleLabel: 'Servo' });
    expect(board.unassigned[1]).toMatchObject({ roleLabel: 'Coordenador', hadMultipleMinistries: false });
    expect(m1.members[0]).toEqual({ type: 'RESIDENT', id: 'r1', name: 'Bruno', photoThumbUrl: null, currentMinistryIds: ['m1'] });
  });

  it('segundo GET no mesmo dia devolve a mesma sessão', async () => {
    const { service, state } = makeFake();
    const first = await service.current(coord);
    const second = await service.current(coord);
    expect(second.session.id).toBe(first.session.id);
    expect(state.sessions).toHaveLength(1);
    expect(second.session.version).toBe(0); // nada mudou → sem bump
  });

  it('OPEN de dia anterior → DISCARDED + nova pré-preenchida, com daily:reset', async () => {
    const { service, state, events } = makeFake();
    state.sessions.push({ id: 'old', houseId: 'h1', status: 'OPEN', sessionDate: '2000-01-01', version: 7 });
    const board = await service.current(coord);
    expect(state.sessions.find((s) => s.id === 'old')!.status).toBe(DailySessionStatus.DISCARDED);
    expect(board.session.id).not.toBe('old');
    expect(events.emit).toHaveBeenCalledWith(DAILY_RESET_EVENT, {
      previousSessionId: 'old', sessionId: board.session.id, houseId: 'h1',
    });
  });

  it('sem OPEN mas com APLICADA hoje → devolve a aplicada (somente leitura)', async () => {
    const { service, state } = makeFake();
    state.sessions.push({
      id: 'done', houseId: 'h1', status: 'APPLIED', sessionDate: todayInSaoPaulo(), version: 3,
      appliedAt: new Date('2026-10-27T12:00:00Z'), appliedByUserId: 'u-coord',
    });
    state.assignments.push({ id: 'a1', sessionId: 'done', personType: R, personId: 'r2', ministryId: 'm2' });
    const board = await service.current(coord);
    expect(board.session).toMatchObject({
      id: 'done', status: 'APPLIED', appliedByName: 'Coord', appliedAt: '2026-10-27T12:00:00.000Z',
    });
    expect(boxOf(board, 'r2')).toBe('m2');
    // Quem não estava na sessão aplicada não aparece.
    expect(boxOf(board, 'r1')).toBeUndefined();
  });
});

describe('DailyService.current — sync a cada GET (decisão 5)', () => {
  it('pessoa nova entra em "Sem ministério"; inelegível sai; ministério excluído solta os membros', async () => {
    const { service, state } = makeFake();
    const first = await service.current(coord);

    state.people = state.people.filter((p) => p.id !== 'r1' && p.id !== 's2'); // alta + desligado
    state.people.push(person(R, 'r3', 'Fábio', ['m1'])); // acolhido depois
    state.ministries = state.ministries.filter((mi) => mi.id !== 'm1'); // m1 excluído

    const board = await service.current(coord);
    expect(board.session.id).toBe(first.session.id);
    expect(board.session.version).toBe(1);
    expect(boxOf(board, 'r1')).toBeUndefined();
    expect(boxOf(board, 's2')).toBeUndefined();
    expect(boxOf(board, 'r3')).toBeNull(); // novo → Sem ministério, mesmo já tendo ministério real
    expect(boxOf(board, 's1')).toBeNull(); // estava em m1 (excluído)
    expect(board.ministries.map((m) => m.id)).toEqual(['m2']);
  });
});

describe('DailyService.start — "Nova daily"', () => {
  it('depois de aplicar abre nova sessão e avisa a room da anterior', async () => {
    const { service, events } = makeFake();
    const first = await service.current(coord);
    await service.apply(coord, first.session.id);
    const next = await service.start(coord);
    expect(next.session.id).not.toBe(first.session.id);
    expect(next.session.status).toBe('OPEN');
    expect(events.emit).toHaveBeenCalledWith(DAILY_RESET_EVENT, expect.objectContaining({
      previousSessionId: first.session.id, sessionId: next.session.id,
    }));
  });

  it('com OPEN do dia já aberta devolve a mesma (sem reset)', async () => {
    const { service, events } = makeFake();
    const first = await service.current(coord);
    const again = await service.start(coord);
    expect(again.session.id).toBe(first.session.id);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('sem sessão nenhuma abre a primeira sem reset', async () => {
    const { service, events } = makeFake();
    const board = await service.start(coord);
    expect(board.session.status).toBe('OPEN');
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('OPEN de ontem é descartada e vira o "anterior" do reset', async () => {
    const { service, state, events } = makeFake();
    state.sessions.push({ id: 'old', houseId: 'h1', status: 'OPEN', sessionDate: '2000-01-01', version: 0 });
    const board = await service.start(coord);
    expect(events.emit).toHaveBeenCalledWith(DAILY_RESET_EVENT, expect.objectContaining({
      previousSessionId: 'old', sessionId: board.session.id,
    }));
  });
});

describe('DailyService.move (decisão 7)', () => {
  it('grava o destino, incrementa version e emite o evento', async () => {
    const { service, state, events } = makeFake();
    const { session } = await service.current(coord);
    const res = await service.move(coord, session.id, { personType: R, personId: 'r2', toMinistryId: 'm2' });
    expect(res).toEqual({ version: 1 });
    expect(state.assignments.find((a) => a.personId === 'r2')!.ministryId).toBe('m2');
    expect(events.emit).toHaveBeenCalledWith(DAILY_MOVED_EVENT, {
      sessionId: session.id, personType: R, personId: 'r2', toMinistryId: 'm2', version: 1, movedByUserId: 'u-coord',
    });
  });

  it('destino null ("Sem ministério") ok', async () => {
    const { service, state } = makeFake();
    const { session } = await service.current(coord);
    await service.move(coord, session.id, { personType: R, personId: 'r1', toMinistryId: null });
    expect(state.assignments.find((a) => a.personId === 'r1')!.ministryId).toBeNull();
  });

  it('ministério de outra casa ou excluído → 400 sem bump', async () => {
    const { service, repo } = makeFake();
    const { session } = await service.current(coord);
    await expect(
      service.move(coord, session.id, { personType: R, personId: 'r1', toMinistryId: 'm-x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.bumpVersion).not.toHaveBeenCalled();
  });

  it('pessoa fora do board → 400', async () => {
    const { service } = makeFake();
    const { session } = await service.current(coord);
    await expect(
      service.move(coord, session.id, { personType: S, personId: 'r1', toMinistryId: 'm1' }),
    ).rejects.toThrow('Pessoa fora do board desta daily.');
  });

  it('sessão APPLIED → 409', async () => {
    const { service, events } = makeFake();
    const { session } = await service.current(coord);
    await service.apply(coord, session.id);
    events.emit.mockClear();
    await expect(
      service.move(coord, session.id, { personType: R, personId: 'r1', toMinistryId: null }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('DailyService.apply (decisão 8)', () => {
  it('aplica cada pessoa pelo MinistryService na transação e marca APPLIED', async () => {
    const { service, state, ministries, manager, events } = makeFake();
    const { session } = await service.current(coord);
    await service.move(coord, session.id, { personType: R, personId: 'r2', toMinistryId: 'm2' });
    await service.move(coord, session.id, { personType: S, personId: 's1', toMinistryId: null });
    ministries.setResidentMinistry.mockImplementation(async (_m, id) => id === 'r2');
    ministries.setStaffMinistry.mockImplementation(async (_m, id) => id === 's1');

    const result = await service.apply(coord, session.id);
    expect(result).toEqual({ applied: 2, skipped: [] });
    expect(ministries.setResidentMinistry).toHaveBeenCalledWith(manager, 'r2', 'm2');
    expect(ministries.setResidentMinistry).toHaveBeenCalledWith(manager, 'r1', 'm1');
    expect(ministries.setStaffMinistry).toHaveBeenCalledWith(manager, 's1', null);
    expect(ministries.setStaffMinistry).toHaveBeenCalledWith(manager, 'c1', null);

    const saved = state.sessions.find((s) => s.id === session.id)!;
    expect(saved).toMatchObject({ status: 'APPLIED', appliedByUserId: 'u-coord' });
    expect(saved.appliedAt).toBeInstanceOf(Date);
    expect(events.emit).toHaveBeenCalledWith(DAILY_APPLIED_EVENT, expect.objectContaining({
      sessionId: session.id, appliedByUserId: 'u-coord', appliedByName: 'Coord', result,
    }));
  });

  it('inelegível no momento do apply vai para skipped e o resto aplica', async () => {
    const { service, state, ministries } = makeFake();
    const { session } = await service.current(coord);
    state.people = state.people.filter((p) => p.id !== 'r1' && p.id !== 's2');

    const result = await service.apply(coord, session.id);
    expect(result.skipped).toEqual([
      { personType: R, personId: 'r1', reason: DAILY_SKIP_REASONS.RESIDENT_NOT_ELIGIBLE },
      { personType: S, personId: 's2', reason: DAILY_SKIP_REASONS.STAFF_NOT_ACTIVE },
    ]);
    expect(ministries.setResidentMinistry).not.toHaveBeenCalledWith(expect.anything(), 'r1', expect.anything());
    expect(result.applied).toBe(3); // r2, s1, c1
  });

  it('destino que virou ministério excluído aplica como "Sem ministério"', async () => {
    const { service, state, ministries, manager } = makeFake();
    const { session } = await service.current(coord);
    state.ministries = state.ministries.filter((mi) => mi.id !== 'm2');
    await service.apply(coord, session.id);
    expect(ministries.setStaffMinistry).toHaveBeenCalledWith(manager, 's2', null);
  });

  it('aplicar de novo → 409', async () => {
    const { service } = makeFake();
    const { session } = await service.current(coord);
    await service.apply(coord, session.id);
    await expect(service.apply(coord, session.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('falha no meio → erro propaga da transação (rollback), sessão não vira APPLIED, sem evento', async () => {
    const { service, state, ministries, repo, events } = makeFake();
    const { session } = await service.current(coord);
    ministries.setStaffMinistry.mockRejectedValueOnce(new Error('boom'));
    await expect(service.apply(coord, session.id)).rejects.toThrow('boom');
    expect(repo.saveSession).not.toHaveBeenCalled();
    expect(state.sessions.find((s) => s.id === session.id)!.status).toBe('OPEN');
    expect(events.emit).not.toHaveBeenCalledWith(DAILY_APPLIED_EVENT, expect.anything());
  });

  it('sessão sumiu entre a checagem e o lock → 409', async () => {
    const { service, repo } = makeFake();
    const { session } = await service.current(coord);
    repo.lockSession.mockResolvedValueOnce(null);
    await expect(service.apply(coord, session.id)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('DailyService — corrida na abertura (índice único parcial)', () => {
  it('23505 na criação → repete e encontra a sessão do outro aparelho', async () => {
    const { service, repo, state } = makeFake();
    repo.createSession.mockImplementationOnce(async () => {
      state.sessions.push({ id: 'theirs', houseId: 'h1', status: 'OPEN', sessionDate: todayInSaoPaulo(), version: 0 });
      throw Object.assign(new Error('dup'), { driverError: { code: '23505' } });
    });
    const board = await service.current(coord);
    expect(board.session.id).toBe('theirs');
  });

  it('erro que não é de unicidade propaga', async () => {
    const { service, repo } = makeFake();
    repo.createSession.mockRejectedValueOnce(new Error('db down'));
    await expect(service.current(coord)).rejects.toThrow('db down');
  });
});

describe('toPerson', () => {
  it('servo com rank: badge do rank, sem roleLabel', () => {
    expect(toPerson(person(S, 's', 'X', ['m1'], { rank: ServantRank.ALIANCADO }))).toMatchObject({
      rank: 'ALIANCADO', roleLabel: null, hadMultipleMinistries: false,
    });
  });

  it('staff sem rank e role desconhecida cai em "Servo"', () => {
    expect(toPerson(person(S, 's', 'X', [], { role: null })).roleLabel).toBe('Servo');
    expect(toPerson(person(S, 's', 'X', [], { role: 'ADMIN' })).roleLabel).toBe('Administrador');
  });
});
