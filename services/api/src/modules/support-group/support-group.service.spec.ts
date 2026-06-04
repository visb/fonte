import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SupportGroupService } from './support-group.service';
import { SupportGroup } from './support-group.entity';
import { SupportGroupMeeting } from './support-group-meeting.entity';
import { SupportGroupCheckin } from './support-group-checkin.entity';
import { SupportGroupRelativeCheckin } from './support-group-relative-checkin.entity';
import { Relative } from '../relative/relative.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}, queryImpl?: jest.Mock) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'id-1', checkedInAt: new Date(), ...v })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: { query: queryImpl ?? jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

function makeService(repos: {
  group?: ReturnType<typeof makeRepo>;
  meeting?: ReturnType<typeof makeRepo>;
  checkin?: ReturnType<typeof makeRepo>;
  relativeCheckin?: ReturnType<typeof makeRepo>;
  relative?: ReturnType<typeof makeRepo>;
} = {}) {
  return new SupportGroupService(
    (repos.group ?? makeRepo()) as unknown as Repository<SupportGroup>,
    (repos.meeting ?? makeRepo()) as unknown as Repository<SupportGroupMeeting>,
    (repos.checkin ?? makeRepo()) as unknown as Repository<SupportGroupCheckin>,
    (repos.relativeCheckin ?? makeRepo()) as unknown as Repository<SupportGroupRelativeCheckin>,
    (repos.relative ?? makeRepo()) as unknown as Repository<Relative>,
  );
}

describe('SupportGroupService.create', () => {
  it('persists the group with a nullable coordinator', async () => {
    const group = makeRepo();
    const service = makeService({ group });

    await service.create({ name: 'G1', churchName: 'Igreja', address: 'Rua 1', dayOfWeek: 6 } as never);

    expect(group.save.mock.calls[0][0]).toMatchObject({ name: 'G1', coordinatorId: null, dayOfWeek: 6 });
  });
});

describe('SupportGroupService.update', () => {
  it('throws NotFound for a missing group', async () => {
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ group });
    await expect(service.update('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('patches only the provided fields', async () => {
    const existing = { id: 'g1', name: 'Old', churchName: 'C', address: 'A', coordinatorId: null, dayOfWeek: 1 };
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue({ ...existing }) });
    const service = makeService({ group });

    await service.update('g1', { name: 'New' } as never);

    const saved = group.save.mock.calls[0][0];
    expect(saved.name).toBe('New');
    expect(saved.dayOfWeek).toBe(1);
  });
});

describe('SupportGroupService.remove', () => {
  it('throws NotFound for a missing group', async () => {
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ group });
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes an existing group', async () => {
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'g1' }) });
    const service = makeService({ group });
    await service.remove('g1');
    expect(group.softDelete).toHaveBeenCalledWith('g1');
  });
});

describe('SupportGroupService.createMeeting', () => {
  it('throws NotFound when the group is missing', async () => {
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ group });
    await expect(service.createMeeting('nope', { date: '2026-06-01' } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SupportGroupService.addCheckin', () => {
  it('throws NotFound when the meeting is missing', async () => {
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ meeting });
    await expect(service.addCheckin('nope', 'res-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the resident is missing', async () => {
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const group = makeRepo({}, jest.fn().mockResolvedValue([])); // resident lookup returns no row
    const service = makeService({ group, meeting });
    await expect(service.addCheckin('m1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate family checkin', async () => {
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const group = makeRepo({}, jest.fn().mockResolvedValue([{ id: 'res-1', name: 'Fulano' }]));
    const checkin = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const service = makeService({ group, meeting, checkin });
    await expect(service.addCheckin('m1', 'res-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a checkin and returns the resident name', async () => {
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const group = makeRepo({}, jest.fn().mockResolvedValue([{ id: 'res-1', name: 'Fulano' }]));
    const checkin = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({ id: 'c1', meetingId: 'm1', residentId: 'res-1', checkedInAt: new Date() }),
    });
    const service = makeService({ group, meeting, checkin });

    const result = await service.addCheckin('m1', 'res-1');
    expect(result.residentName).toBe('Fulano');
  });
});

describe('SupportGroupService.addRelativeCheckin', () => {
  it('throws NotFound when the relative profile is missing', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ relative });
    await expect(service.addRelativeCheckin('user-1', 'tok')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the token matches no meeting', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', name: 'Mãe' }) });
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ relative, meeting });
    await expect(service.addRelativeCheckin('user-1', 'bad')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate relative checkin', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', name: 'Mãe' }) });
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const relativeCheckin = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rc1' }) });
    const service = makeService({ relative, meeting, relativeCheckin });
    await expect(service.addRelativeCheckin('user-1', 'tok')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SupportGroupService.removeCheckin', () => {
  it('throws NotFound for a missing checkin', async () => {
    const checkin = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ checkin });
    await expect(service.removeCheckin('m1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
