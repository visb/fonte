import { ConflictException, NotFoundException } from '@nestjs/common';
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

  it('merges filhos and servos into members', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'm1', name: 'Cozinha', house_id: 'h1', leader_id: null, leader_type: null, leader_name: null }])
      .mockResolvedValueOnce([{ id: 'r1', name: 'Filho' }]) // filhos
      .mockResolvedValueOnce([{ id: 's1', name: 'Servo' }]); // servos
    const repo = makeRepo({}, query);
    const service = makeService(repo);

    const result = await service.findOne('m1');
    expect(result.members).toEqual([
      { id: 'r1', name: 'Filho', role: 'FILHO' },
      { id: 's1', name: 'Servo', role: 'SERVO' },
    ]);
  });
});

describe('MinistryService.update', () => {
  it('throws NotFound for a missing ministry', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.update('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MinistryService.addResident', () => {
  it('throws NotFound when the ministry is missing', async () => {
    const service = makeService(makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    await expect(service.addResident('nope', 'res-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a resident from a different house', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'res-1', house_id: 'other-house' }]);
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1' }) }, query);
    const service = makeService(repo);
    await expect(service.addResident('m1', 'res-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('attaches a resident from the same house', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'res-1', house_id: 'h1' }]) // resident lookup
      .mockResolvedValueOnce(undefined); // UPDATE
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1', houseId: 'h1' }) }, query);
    const service = makeService(repo);

    await service.addResident('m1', 'res-1');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE residents SET ministry_id'), ['m1', 'res-1']);
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

describe('MinistryService.removeResident', () => {
  it('detaches the resident from the ministry', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const service = makeService(makeRepo({}, query));
    await service.removeResident('m1', 'res-1');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SET ministry_id = NULL'),
      ['res-1', 'm1'],
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
