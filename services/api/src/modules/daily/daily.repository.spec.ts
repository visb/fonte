import { DailyPersonType, DailySessionStatus } from '@fonte/types';
import { DailyRepository } from './daily.repository';
import { DailySession } from './daily-session.entity';
import { DailySessionAssignment } from './daily-session-assignment.entity';

function makeRepo() {
  const sessionRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 's1' }),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 'new', ...v })),
  };
  const assignmentRepo = {
    find: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    create: jest.fn((v) => v),
    save: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const query = jest.fn().mockResolvedValue([]);
  const m = {
    query,
    getRepository: jest.fn((entity: unknown) => (entity === DailySession ? sessionRepo : assignmentRepo)),
  };
  const rootQuery = jest.fn().mockResolvedValue([]);
  const sessions = { findOne: jest.fn().mockResolvedValue(null), manager: { query: rootQuery } };
  const repo = new DailyRepository(sessions as never);
  return { repo, m: m as never, sessionRepo, assignmentRepo, query, sessions, rootQuery };
}

describe('DailyRepository — sessões', () => {
  it('findSession busca pelo id', async () => {
    const { repo, sessions } = makeRepo();
    await repo.findSession('s1');
    expect(sessions.findOne).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('lockOpenSession/lockSession travam a linha (pessimistic_write)', async () => {
    const { repo, m, sessionRepo } = makeRepo();
    await repo.lockOpenSession(m, 'h1');
    expect(sessionRepo.findOne).toHaveBeenCalledWith({
      where: { houseId: 'h1', status: DailySessionStatus.OPEN },
      lock: { mode: 'pessimistic_write' },
    });
    await repo.lockSession(m, 's1');
    expect(sessionRepo.findOne).toHaveBeenLastCalledWith({ where: { id: 's1' }, lock: { mode: 'pessimistic_write' } });
  });

  it('findAppliedOn: APLICADA da casa no dia, a mais recente', async () => {
    const { repo, m, sessionRepo } = makeRepo();
    await repo.findAppliedOn(m, 'h1', '2026-10-27');
    expect(sessionRepo.findOne).toHaveBeenCalledWith({
      where: { houseId: 'h1', sessionDate: '2026-10-27', status: DailySessionStatus.APPLIED },
      order: { appliedAt: 'DESC' },
    });
  });

  it('createSession/saveSession persistem pelo manager da transação', async () => {
    const { repo, m, sessionRepo } = makeRepo();
    await expect(repo.createSession(m, { houseId: 'h1' })).resolves.toMatchObject({ id: 'new', houseId: 'h1' });
    await repo.saveSession(m, { id: 's1' } as DailySession);
    expect(sessionRepo.save).toHaveBeenLastCalledWith({ id: 's1' });
  });

  it('bumpVersion lê o RETURNING nos dois formatos do driver', async () => {
    const { repo, m, query } = makeRepo();
    query.mockResolvedValueOnce([[{ version: 3 }], 1]);
    await expect(repo.bumpVersion(m, 's1')).resolves.toBe(3);
    query.mockResolvedValueOnce([{ version: '4' }]);
    await expect(repo.bumpVersion(m, 's1')).resolves.toBe(4);
    expect(query.mock.calls[0][0]).toContain('version = version + 1');
  });
});

describe('DailyRepository — assignments', () => {
  it('listAssignments filtra pela sessão', async () => {
    const { repo, m, assignmentRepo } = makeRepo();
    await expect(repo.listAssignments(m, 's1')).resolves.toEqual([{ id: 'a1' }]);
    expect(assignmentRepo.find).toHaveBeenCalledWith({ where: { sessionId: 's1' } });
  });

  it('insert/delete/clear são no-op com lista vazia', async () => {
    const { repo, m, assignmentRepo } = makeRepo();
    await repo.insertAssignments(m, []);
    await repo.deleteAssignments(m, []);
    await repo.clearAssignmentMinistry(m, []);
    expect(assignmentRepo.save).not.toHaveBeenCalled();
    expect(assignmentRepo.delete).not.toHaveBeenCalled();
    expect(assignmentRepo.update).not.toHaveBeenCalled();
  });

  it('insert/delete/clear com ids', async () => {
    const { repo, m, assignmentRepo } = makeRepo();
    await repo.insertAssignments(m, [{ sessionId: 's1' } as Partial<DailySessionAssignment>]);
    expect(assignmentRepo.save).toHaveBeenCalledWith([{ sessionId: 's1' }]);
    await repo.deleteAssignments(m, ['a1']);
    expect(assignmentRepo.delete).toHaveBeenCalled();
    await repo.clearAssignmentMinistry(m, ['a1']);
    expect(assignmentRepo.update.mock.calls[0][1]).toEqual({ ministryId: null });
  });

  it('setAssignment: true quando a pessoa está no board, false quando não', async () => {
    const { repo, m, assignmentRepo } = makeRepo();
    await expect(repo.setAssignment(m, 's1', DailyPersonType.RESIDENT, 'r1', 'm1', 'u1')).resolves.toBe(true);
    expect(assignmentRepo.update).toHaveBeenCalledWith(
      { sessionId: 's1', personType: 'RESIDENT', personId: 'r1' },
      { ministryId: 'm1', updatedByUserId: 'u1' },
    );
    assignmentRepo.update.mockResolvedValueOnce({ affected: 0 });
    await expect(repo.setAssignment(m, 's1', DailyPersonType.STAFF, 'x', null, 'u1')).resolves.toBe(false);
    assignmentRepo.update.mockResolvedValueOnce({});
    await expect(repo.setAssignment(m, 's1', DailyPersonType.STAFF, 'x', null, 'u1')).resolves.toBe(false);
  });
});

describe('DailyRepository — leituras da casa', () => {
  it('listMinistries: vivos da casa por nome', async () => {
    const { repo, m, query } = makeRepo();
    await repo.listMinistries(m, 'h1');
    expect(query.mock.calls[0][0]).toContain('deleted_at IS NULL ORDER BY name');
    expect(query.mock.calls[0][1]).toEqual(['h1']);
  });

  it('isHouseMinistry: casa + não excluído', async () => {
    const { repo, m, query } = makeRepo();
    query.mockResolvedValueOnce([{ id: 'm1' }]).mockResolvedValueOnce([]);
    await expect(repo.isHouseMinistry(m, 'm1', 'h1')).resolves.toBe(true);
    await expect(repo.isHouseMinistry(m, 'm2', 'h1')).resolves.toBe(false);
    expect(query.mock.calls[0][1]).toEqual(['m1', 'h1']);
  });

  it('listEligiblePeople: filhos em acolhimento da casa + staff ativo, normalizados', async () => {
    const { repo, m, query } = makeRepo();
    query
      .mockResolvedValueOnce([{ id: 'r1', name: 'Ana', photoThumbUrl: null, ministryIds: null }])
      .mockResolvedValueOnce([{ id: 's1', name: 'Bia', photoThumbUrl: 'p', rank: undefined, role: undefined, ministryIds: ['m1'] }]);
    const people = await repo.listEligiblePeople(m, 'h1');
    expect(people).toEqual([
      { id: 'r1', name: 'Ana', photoThumbUrl: null, ministryIds: [], type: 'RESIDENT', rank: null, role: null },
      { id: 's1', name: 'Bia', photoThumbUrl: 'p', ministryIds: ['m1'], type: 'STAFF', rank: null, role: null },
    ]);
    const [residentSql, residentParams] = query.mock.calls[0];
    expect(residentSql).toContain('r.status::text = ANY($2::text[])');
    expect(residentParams).toEqual(['h1', ['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE']]);
    const [staffSql] = query.mock.calls[1];
    expect(staffSql).toContain('s.dismissed_at IS NULL');
    expect(staffSql).toContain('ORDER BY ms.created_at ASC');
  });

  it('listEligiblePeople mantém ministryIds de filho quando vem preenchido', async () => {
    const { repo, m, query } = makeRepo();
    query.mockResolvedValueOnce([{ id: 'r1', name: 'Ana', photoThumbUrl: null, ministryIds: ['m1'] }]).mockResolvedValueOnce([
      { id: 's1', name: 'Bia', photoThumbUrl: null, rank: 'ASPIRANTE', role: 'SERVANT', ministryIds: null },
    ]);
    const people = await repo.listEligiblePeople(m, 'h1');
    expect(people[0].ministryIds).toEqual(['m1']);
    expect(people[1]).toMatchObject({ rank: 'ASPIRANTE', role: 'SERVANT', ministryIds: [] });
  });

  it('userName: null sem usuário; nome do staff quando há', async () => {
    const { repo, m, query } = makeRepo();
    await expect(repo.userName(m, null)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
    query.mockResolvedValueOnce([{ name: 'Coord' }]).mockResolvedValueOnce([]);
    await expect(repo.userName(m, 'u1')).resolves.toBe('Coord');
    await expect(repo.userName(m, 'u2')).resolves.toBeNull();
  });

  it('staffHouseId: casa do staff ativo do usuário', async () => {
    const { repo, rootQuery } = makeRepo();
    rootQuery.mockResolvedValueOnce([{ house_id: 'h1' }]).mockResolvedValueOnce([]);
    await expect(repo.staffHouseId('u1')).resolves.toBe('h1');
    await expect(repo.staffHouseId('u2')).resolves.toBeNull();
    expect(rootQuery.mock.calls[0][0]).toContain('staff.dismissed_at IS NULL');
  });

  it('houseExists', async () => {
    const { repo, rootQuery } = makeRepo();
    rootQuery.mockResolvedValueOnce([{ id: 'h1' }]).mockResolvedValueOnce([]);
    await expect(repo.houseExists('h1')).resolves.toBe(true);
    await expect(repo.houseExists('h2')).resolves.toBe(false);
  });
});
