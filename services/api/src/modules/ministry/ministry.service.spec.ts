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
});
