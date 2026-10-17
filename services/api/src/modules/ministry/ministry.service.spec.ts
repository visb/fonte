import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MinistryService } from './ministry.service';
import { Ministry } from './ministry.entity';
import { MinistryStaff } from './ministry-staff.entity';
import { MinistryTask } from './ministry-task.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}, queryImpl?: jest.Mock) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'id-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: { query: queryImpl ?? jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

function makeService(repo: ReturnType<typeof makeRepo>, staffRepo = makeRepo(), taskRepo = makeRepo()) {
  return new MinistryService(
    repo as unknown as Repository<Ministry>,
    staffRepo as unknown as Repository<MinistryStaff>,
    taskRepo as unknown as Repository<MinistryTask>,
  );
}

describe('MinistryService.findOne', () => {
  it('throws NotFound when no row matches', async () => {
    const repo = makeRepo({}, jest.fn().mockResolvedValue([])); // [rows] = [] → rows undefined
    const service = makeService(repo);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  // Story 205: filho volta a ser membro (role FILHO), ao lado dos servos.
  it('devolve líder filho, filhos e servos em members', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'm1', name: 'Cozinha', house_id: 'h1', leader_id: 'r9', leader_type: 'RESIDENT', leader_name: 'Líder Filho' },
      ])
      .mockResolvedValueOnce([{ id: 'r1', name: 'Filho' }]) // filhos
      .mockResolvedValueOnce([{ id: 's1', name: 'Servo' }]); // servos
    const service = makeService(makeRepo({}, query));

    const result = await service.findOne('m1');
    expect(result.leaderType).toBe('RESIDENT');
    expect(result.leaderName).toBe('Líder Filho');
    expect(result.members).toEqual([
      { id: 'r1', name: 'Filho', role: 'FILHO' },
      { id: 's1', name: 'Servo', role: 'SERVO' },
    ]);
  });

  // Decisão 8: dado legado incoerente não aparece — só filho em acolhimento na casa.
  it('a consulta de filhos filtra por casa do ministério e status em acolhimento', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'm1', name: 'Cozinha', house_id: 'h1', leader_id: null, leader_type: null, leader_name: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = makeService(makeRepo({}, query));

    const result = await service.findOne('m1');
    expect(result).toMatchObject({ leaderId: null, leaderType: null, leaderName: null, members: [] });
    const [sql, params] = query.mock.calls[1];
    expect(String(sql)).toContain('FROM residents');
    expect(String(sql)).toContain('house_id = $2');
    expect(params).toEqual(['m1', 'h1', ['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE']]);
  });

  // Story 207: leaderRank só para líder servo.
  it('devolve leaderRank do líder servo', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'm1', name: 'Cozinha', house_id: 'h1', leader_id: 's1', leader_type: 'STAFF',
          leader_name: 'Servo', leader_rank: 'ALIANCADO',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = makeService(makeRepo({}, query));

    const result = await service.findOne('m1');
    expect(result.leaderRank).toBe('ALIANCADO');
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toContain(
      `CASE WHEN m.leader_type = 'STAFF' THEN s.rank ELSE NULL END AS leader_rank`,
    );
  });

  it('leaderRank null para líder filho e para ministério sem líder', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'm1', name: 'A', house_id: 'h1', leader_id: 'r1', leader_type: 'RESIDENT', leader_name: 'Filho', leader_rank: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'm2', name: 'B', house_id: 'h1', leader_id: null, leader_type: null, leader_name: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = makeService(makeRepo({}, query));

    expect((await service.findOne('m1')).leaderRank).toBeNull();
    expect((await service.findOne('m2')).leaderRank).toBeNull();
  });
});

describe('MinistryService.update', () => {
  it('throws NotFound for a missing ministry', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.update('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── Story 205 — guard da decisão 6 ──────────────────────────────────────────

const ELIGIBLE = ['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE'];
const INELIGIBLE = ['DISCHARGED', 'EVADED', 'ARCHIVED', 'PRE_ADMISSION', 'CENSUS_ADDED', 'REJECTED_CENSUS'];

function residentQuery(resident: { house_id: string | null; status: string } | null) {
  return jest.fn().mockResolvedValue(resident ? [{ id: 'r1', ...resident }] : []);
}

describe('MinistryService.addResident (story 205)', () => {
  it('404 quando o ministério não existe', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.addResident('nope', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 quando o filho não existe', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1' }) }, residentQuery(null));
    await expect(makeService(repo).addResident('m1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(ELIGIBLE)('filho %s da casa entra no ministério', async (status) => {
    const query = residentQuery({ house_id: 'h1', status });
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1' }) }, query);
    await makeService(repo).addResident('m1', 'r1');
    expect(query).toHaveBeenLastCalledWith('UPDATE residents SET ministry_id = $1 WHERE id = $2', ['m1', 'r1']);
  });

  it.each(INELIGIBLE)('filho %s → 400 sem gravar', async (status) => {
    const query = residentQuery({ house_id: 'h1', status });
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1' }) }, query);
    await expect(makeService(repo).addResident('m1', 'r1')).rejects.toThrow(
      'Só filho em acolhimento nesta casa pode participar do ministério.',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('filho de outra casa → 400', async () => {
    const query = residentQuery({ house_id: 'h2', status: 'ACTIVE' });
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1' }) }, query);
    await expect(makeService(repo).addResident('m1', 'r1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('MinistryService.removeResident (story 205)', () => {
  it('zera o ministry_id só se o filho estiver neste ministério', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await makeService(makeRepo({}, query)).removeResident('m1', 'r1');
    expect(query).toHaveBeenCalledWith(
      'UPDATE residents SET ministry_id = NULL WHERE id = $1 AND ministry_id = $2',
      ['r1', 'm1'],
    );
  });
});

describe('MinistryService.update — líder filho (story 205)', () => {
  it.each(ELIGIBLE)('aceita filho %s da casa como líder', async (status) => {
    const repo = makeRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1', leaderId: null, leaderType: null }) },
      residentQuery({ house_id: 'h1', status }),
    );
    await makeService(repo).update('m1', { leaderId: 'r1', leaderType: 'RESIDENT' });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ leaderId: 'r1', leaderType: 'RESIDENT' });
  });

  it.each(INELIGIBLE)('filho %s como líder → 400 sem persistir', async (status) => {
    const repo = makeRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1', leaderId: null, leaderType: null }) },
      residentQuery({ house_id: 'h1', status }),
    );
    await expect(
      makeService(repo).update('m1', { leaderId: 'r1', leaderType: 'RESIDENT' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('filho de outra casa como líder → 400', async () => {
    const repo = makeRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1', leaderId: null, leaderType: null }) },
      residentQuery({ house_id: 'h2', status: 'ACTIVE' }),
    );
    await expect(
      makeService(repo).update('m1', { leaderId: 'r1', leaderType: 'RESIDENT' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trocar só o leaderId de um ministério já liderado por filho também valida', async () => {
    const query = residentQuery({ house_id: 'h1', status: 'DISCHARGED' });
    const repo = makeRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1', leaderId: 'r0', leaderType: 'RESIDENT' }) },
      query,
    );
    await expect(makeService(repo).update('m1', { leaderId: 'r1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renomear um ministério liderado por filho não revalida o líder', async () => {
    const query = jest.fn();
    const repo = makeRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1', leaderId: 'r0', leaderType: 'RESIDENT' }) },
      query,
    );
    await makeService(repo).update('m1', { name: 'Horta' });
    expect(query).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('MinistryService.addStaff', () => {
  it('rejects a staff already in the ministry', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'ms1' }) });
    const service = makeService(repo, staffRepo);
    await expect(service.addStaff('m1', 's1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('MinistryService.updateTask', () => {
  it('stamps completedAt when marking complete and clears it otherwise', async () => {
    const taskRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 't1', ministryId: 'm1' }) });
    const service = makeService(makeRepo(), makeRepo(), taskRepo);

    await service.updateTask('m1', 't1', { completed: true } as never);
    expect(taskRepo.save.mock.calls[0][0].completedAt).toBeInstanceOf(Date);

    taskRepo.findOne.mockResolvedValue({ id: 't1', ministryId: 'm1', completedAt: new Date() });
    await service.updateTask('m1', 't1', { completed: false } as never);
    expect(taskRepo.save.mock.calls[1][0].completedAt).toBeNull();
  });

  it('throws NotFound for a missing task', async () => {
    const taskRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), makeRepo(), taskRepo);
    await expect(service.updateTask('m1', 'nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MinistryService.createTask', () => {
  it('defaults repetition to NONE', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const taskRepo = makeRepo();
    const service = makeService(repo, makeRepo(), taskRepo);

    await service.createTask('m1', { title: 'Limpar' } as never);
    expect(taskRepo.create.mock.calls[0][0].repetition).toBe('NONE');
  });

  it('throws NotFound when the ministry is missing', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.createTask('nope', { title: 'x' } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('MinistryService.findByHouse', () => {
  it('runs the aggregate query scoped to the house', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'm1' }]);
    const service = makeService(makeRepo({}, query));
    const rows = await service.findByHouse('h1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM ministries m'), [
      'h1',
      ['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE'],
    ]);
    expect(rows).toEqual([{ id: 'm1' }]);
  });

  // Story 205 (decisões 8 e 10): contagem separada; filho só conta em acolhimento na casa.
  it('conta servos e filhos separados, filtrando filho por casa e status', async () => {
    const query = jest.fn().mockResolvedValue([
      { id: 'm1', name: 'Cozinha', leaderId: 's1', leaderType: 'STAFF', leaderName: 'Servo', filhoCount: 3, servoCount: 2 },
    ]);
    const service = makeService(makeRepo({}, query));

    const rows = await service.findByHouse('h1');
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toContain('"filhoCount"');
    expect(String(sql)).toContain('"servoCount"');
    expect(String(sql)).toContain('res.house_id = m.house_id');
    expect(String(sql)).toContain("WHEN m.leader_type = 'RESIDENT' THEN r.name");
    expect(rows[0]).toMatchObject({ filhoCount: 3, servoCount: 2 });
  });

  // Story 207: nível do líder só quando o líder é servo.
  it('devolve leaderRank do servo líder e null para líder filho ou sem líder', async () => {
    const query = jest.fn().mockResolvedValue([
      { id: 'm1', leaderType: 'STAFF', leaderRank: 'CONSAGRADO' },
      { id: 'm2', leaderType: 'RESIDENT', leaderRank: null },
      { id: 'm3', leaderType: null, leaderRank: null },
    ]);
    const service = makeService(makeRepo({}, query));

    const rows = await service.findByHouse('h1');
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toContain(
      `CASE WHEN m.leader_type = 'STAFF' THEN s.rank ELSE NULL END AS "leaderRank"`,
    );
    expect(String(sql)).toContain('s.rank');
    expect(rows.map((r) => r.leaderRank)).toEqual(['CONSAGRADO', null, null]);
  });
});

describe('MinistryService.create', () => {
  it('persists a new ministry with the house id', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.create('h1', { name: 'Louvor' } as never);
    expect(repo.create).toHaveBeenCalledWith({ name: 'Louvor', houseId: 'h1' });
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('MinistryService.update (success)', () => {
  it('applies provided fields and saves', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'm1', name: 'old' }),
    });
    const service = makeService(repo);
    await service.update('m1', { name: 'novo', leaderId: 's1', leaderType: 'STAFF' } as never);
    const saved = repo.save.mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'novo', leaderId: 's1', leaderType: 'STAFF' });
  });

  it('nulls leader fields when explicitly cleared', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'm1', leaderId: 's1', leaderType: 'STAFF' }),
    });
    const service = makeService(repo);
    await service.update('m1', { leaderId: null, leaderType: null } as never);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.leaderId).toBeNull();
    expect(saved.leaderType).toBeNull();
  });
});

describe('MinistryService.remove', () => {
  it('throws NotFound for a missing ministry', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes an existing ministry', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const service = makeService(repo);
    await service.remove('m1');
    expect(repo.softDelete).toHaveBeenCalledWith('m1');
  });

  // Story 205: soft delete não dispara o ON DELETE SET NULL da FK.
  it('tira os filhos do ministério excluído', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    await makeService(repo).remove('m1');
    expect(repo.manager.query).toHaveBeenCalledWith(
      'UPDATE residents SET ministry_id = NULL WHERE ministry_id = $1',
      ['m1'],
    );
  });
});

describe('MinistryService.addStaff (success)', () => {
  it('throws NotFound when ministry is missing', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.addStaff('nope', 's1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates the membership when not already present', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const staffRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo, staffRepo);
    await service.addStaff('m1', 's1');
    expect(staffRepo.create).toHaveBeenCalledWith({ ministryId: 'm1', staffId: 's1' });
    expect(staffRepo.save).toHaveBeenCalled();
  });
});

describe('MinistryService.removeStaff', () => {
  it('deletes the membership row', async () => {
    const staffRepo = makeRepo();
    const service = makeService(makeRepo(), staffRepo);
    await service.removeStaff('m1', 's1');
    expect(staffRepo.delete).toHaveBeenCalledWith({ ministryId: 'm1', staffId: 's1' });
  });
});

describe('MinistryService.findTasks', () => {
  it('lists tasks ordered by createdAt', async () => {
    const taskRepo = makeRepo();
    const service = makeService(makeRepo(), makeRepo(), taskRepo);
    await service.findTasks('m1');
    expect(taskRepo.find).toHaveBeenCalledWith({
      where: { ministryId: 'm1' },
      order: { createdAt: 'ASC' },
    });
  });
});

describe('MinistryService.removeTask', () => {
  it('throws NotFound for a missing task', async () => {
    const taskRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeRepo(), makeRepo(), taskRepo);
    await expect(service.removeTask('m1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes an existing task', async () => {
    const taskRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 't1' }) });
    const service = makeService(makeRepo(), makeRepo(), taskRepo);
    await service.removeTask('m1', 't1');
    expect(taskRepo.softDelete).toHaveBeenCalledWith('t1');
  });
});
