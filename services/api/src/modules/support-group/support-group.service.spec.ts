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

  it('deletes an existing checkin', async () => {
    const checkin = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'c1' }) });
    const service = makeService({ checkin });
    await service.removeCheckin('m1', 'c1');
    expect(checkin.delete).toHaveBeenCalledWith('c1');
  });
});

describe('SupportGroupService.findAll', () => {
  it('runs the listing query and returns rows', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'g1' }]);
    const service = makeService({ group: makeRepo({}, query) });
    await expect(service.findAll()).resolves.toEqual([{ id: 'g1' }]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM support_groups g'));
  });
});

describe('SupportGroupService.findOne', () => {
  it('returns the row when found', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'g1', name: 'G1' }]);
    const service = makeService({ group: makeRepo({}, query) });
    await expect(service.findOne('g1')).resolves.toMatchObject({ id: 'g1' });
  });

  it('throws NotFound when no row matches', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = makeService({ group: makeRepo({}, query) });
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SupportGroupService.findMeetings', () => {
  it('throws NotFound when the group is missing', async () => {
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ group });
    await expect(service.findMeetings('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns aggregated meetings for an existing group', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'm1' }]);
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'g1' }) }, query);
    const service = makeService({ group });
    await expect(service.findMeetings('g1')).resolves.toEqual([{ id: 'm1' }]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM support_group_meetings m'), ['g1']);
  });
});

describe('SupportGroupService.findAllMeetings', () => {
  it('runs the global meetings query', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'm1' }]);
    const service = makeService({ group: makeRepo({}, query) });
    await expect(service.findAllMeetings()).resolves.toEqual([{ id: 'm1' }]);
  });
});

describe('SupportGroupService.findMeetingRelativeCheckins', () => {
  it('throws NotFound when the meeting is missing', async () => {
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ meeting });
    await expect(service.findMeetingRelativeCheckins('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns relative checkins for an existing meeting', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'rc1' }]);
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const group = makeRepo({}, query);
    const service = makeService({ group, meeting });
    await expect(service.findMeetingRelativeCheckins('m1')).resolves.toEqual([{ id: 'rc1' }]);
  });
});

describe('SupportGroupService check-in history', () => {
  it('returns relative checkin history', async () => {
    const query = jest.fn().mockResolvedValue([{ meetingId: 'm1' }]);
    const service = makeService({ group: makeRepo({}, query) });
    await expect(service.findRelativeCheckinHistory('rel-1')).resolves.toEqual([{ meetingId: 'm1' }]);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['rel-1']);
  });

  it('returns resident checkin history', async () => {
    const query = jest.fn().mockResolvedValue([{ meetingId: 'm2' }]);
    const service = makeService({ group: makeRepo({}, query) });
    await expect(service.findResidentCheckinHistory('res-1')).resolves.toEqual([{ meetingId: 'm2' }]);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['res-1']);
  });
});

describe('SupportGroupService.createMeeting (success)', () => {
  it('persists a meeting for an existing group', async () => {
    const group = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'g1' }) });
    const meeting = makeRepo();
    const service = makeService({ group, meeting });
    await service.createMeeting('g1', { date: '2026-06-01', notes: 'oi' } as never);
    expect(meeting.create).toHaveBeenCalledWith({
      supportGroupId: 'g1',
      date: '2026-06-01',
      notes: 'oi',
    });
  });
});

describe('SupportGroupService.findMeetingDetail', () => {
  it('throws NotFound when the meeting row is missing', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = makeService({ group: makeRepo({}, query) });
    await expect(service.findMeetingDetail('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the meeting with its checkins', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'm1', supportGroupName: 'G1' }])
      .mockResolvedValueOnce([{ id: 'c1', residentName: 'Fulano' }]);
    const service = makeService({ group: makeRepo({}, query) });
    const detail = await service.findMeetingDetail('m1');
    expect(detail.checkins).toEqual([{ id: 'c1', residentName: 'Fulano' }]);
  });
});

describe('SupportGroupService.addRelativeCheckin (success)', () => {
  it('creates the relative checkin and returns the relative name', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', name: 'Mãe' }) });
    const meeting = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'm1' }) });
    const relativeCheckin = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({
        id: 'rc1',
        meetingId: 'm1',
        relativeId: 'rel-1',
        checkedInAt: new Date(),
      }),
    });
    const service = makeService({ relative, meeting, relativeCheckin });
    const result = await service.addRelativeCheckin('user-1', 'tok');
    expect(result.relativeName).toBe('Mãe');
    expect(result.meetingId).toBe('m1');
  });
});
