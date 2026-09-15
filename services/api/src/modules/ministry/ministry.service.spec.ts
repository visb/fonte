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

  // Story 197: membro de ministério é sempre servo — filho deixou de ter vínculo.
  it('devolve líder servo, servos e nenhum filho em members', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'm1', name: 'Cozinha', house_id: 'h1', leader_id: 's9', leader_type: 'STAFF', leader_name: 'Líder Servo' },
      ])
      .mockResolvedValueOnce([{ id: 's1', name: 'Servo' }]); // servos
    const repo = makeRepo({}, query);
    const service = makeService(repo);

    const result = await service.findOne('m1');
    expect(result.leaderType).toBe('STAFF');
    expect(result.leaderName).toBe('Líder Servo');
    expect(result.members).toEqual([{ id: 's1', name: 'Servo', role: 'SERVO' }]);
    expect(result.members.every((m) => m.role === 'SERVO')).toBe(true);
    // Nenhuma consulta pergunta por filhos do ministério (só `ministry_staff`).
    for (const [sql] of query.mock.calls) {
      expect(String(sql)).not.toContain('residents');
    }
  });

  // Decisão 3: a migration zerou o líder dos ministérios liderados por filho.
  it('serializa ministério com líder zerado pela migration sem quebrar', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'm1', name: 'Cozinha', house_id: 'h1', leader_id: null, leader_type: null, leader_name: null },
      ])
      .mockResolvedValueOnce([]);
    const service = makeService(makeRepo({}, query));

    const result = await service.findOne('m1');
    expect(result).toMatchObject({ leaderId: null, leaderType: null, leaderName: null, members: [] });
  });
});

describe('MinistryService.update', () => {
  it('throws NotFound for a missing ministry', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.update('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// Story 197 (decisões 3 e 6): filho não entra nem sai de ministério — as duas
// rotas de membro sumiram e o serviço não tem mais os métodos.
describe('MinistryService — vínculo com filho removido (story 197)', () => {
  it('não expõe addResident/removeResident', () => {
    const service = makeService(makeRepo());
    expect((service as unknown as Record<string, unknown>).addResident).toBeUndefined();
    expect((service as unknown as Record<string, unknown>).removeResident).toBeUndefined();
  });

  it('recusa leaderType RESIDENT com 400 e não persiste nada', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', name: 'old' }) });
    const service = makeService(repo);

    await expect(
      service.update('m1', { name: 'novo', leaderId: 'r1', leaderType: 'RESIDENT' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.findOne).not.toHaveBeenCalled();
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
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM ministries m'), ['h1']);
    expect(rows).toEqual([{ id: 'm1' }]);
  });

  // Story 197: a contagem exibida é a de servos; filho não conta mais.
  it('conta servos e não toca em residents', async () => {
    const query = jest.fn().mockResolvedValue([
      { id: 'm1', name: 'Cozinha', leaderId: 's1', leaderType: 'STAFF', leaderName: 'Servo', servoCount: 2 },
      { id: 'm2', name: 'Limpeza', leaderId: null, leaderType: null, leaderName: null, servoCount: 0 },
    ]);
    const service = makeService(makeRepo({}, query));

    const rows = await service.findByHouse('h1');
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toContain('ms.staff_id');
    expect(String(sql)).not.toContain('residents');
    expect(String(sql)).not.toContain('filhoCount');
    // Ministério sem servo nenhum → 0, não erro.
    expect(rows.map((r) => r.servoCount)).toEqual([2, 0]);
    expect(rows.every((r) => !('filhoCount' in r))).toBe(true);
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
