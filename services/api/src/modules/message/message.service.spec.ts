import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MessageStatus, ProfileType, Role } from '@fonte/types';
import { MessageService } from './message.service';
import { Message } from './message.entity';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { StaffPermission } from '../staff/staff-permission.entity';
import { User } from '../user/user.entity';
import { SupportGroup } from '../support-group/support-group.entity';
import { SupportGroupMeeting } from '../support-group/support-group-meeting.entity';
import { SupportGroupRelativeCheckin } from '../support-group/support-group-relative-checkin.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findByIds: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'msg-1', createdAt: new Date(), ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function makeService(repos: {
  message?: ReturnType<typeof makeRepo>;
  resident?: ReturnType<typeof makeRepo>;
  relative?: ReturnType<typeof makeRepo>;
  staff?: ReturnType<typeof makeRepo>;
  permission?: ReturnType<typeof makeRepo>;
} = {}) {
  return new MessageService(
    (repos.message ?? makeRepo()) as unknown as Repository<Message>,
    (repos.resident ?? makeRepo()) as unknown as Repository<Resident>,
    (repos.relative ?? makeRepo()) as unknown as Repository<Relative>,
    (repos.staff ?? makeRepo()) as unknown as Repository<Staff>,
    makeRepo() as unknown as Repository<SupportGroup>,
    makeRepo() as unknown as Repository<SupportGroupMeeting>,
    makeRepo() as unknown as Repository<SupportGroupRelativeCheckin>,
    makeRepo() as unknown as Repository<User>,
    (repos.permission ?? makeRepo()) as unknown as Repository<StaffPermission>,
  );
}

describe('MessageService.send', () => {
  it('forbids a resident sending for another resident', async () => {
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ resident });
    await expect(
      service.send('user-1', ProfileType.RESIDENT, { residentId: 'res-1', relativeId: 'rel-1', content: 'oi' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an empty message', async () => {
    const service = makeService();
    await expect(
      service.send('user-1', ProfileType.STAFF, { residentId: 'res-1', relativeId: 'rel-1' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when the relative does not belong to the resident', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'other' }) });
    const service = makeService({ relative });
    await expect(
      service.send('user-1', ProfileType.STAFF, { residentId: 'res-1', relativeId: 'rel-1', content: 'oi' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('staff messages are auto-approved', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }) });
    const message = makeRepo();
    const service = makeService({ relative, message });

    await service.send('user-1', ProfileType.STAFF, { residentId: 'res-1', relativeId: 'rel-1', content: 'oi' } as never);
    expect(message.create.mock.calls[0][0].status).toBe(MessageStatus.APPROVED);
  });

  it('relative messages start pending approval', async () => {
    const relative = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1', userId: 'user-1' }),
    });
    const message = makeRepo();
    const service = makeService({ relative, message });

    await service.send('user-1', ProfileType.RELATIVE, { residentId: 'res-1', relativeId: 'rel-1', content: 'oi' } as never);
    expect(message.create.mock.calls[0][0].status).toBe(MessageStatus.PENDING_APPROVAL);
  });
});

describe('MessageService.approve', () => {
  it('forbids staff without the moderate permission', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService({ staff, permission });
    await expect(service.approve('user-1', 'msg-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFound for a missing message', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', name: 'Servo' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(1) });
    const message = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ message, staff, permission });
    await expect(service.approve('user-1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks the message approved', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', name: 'Servo' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(1) });
    const message = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'msg-1' }) });
    const service = makeService({ message, staff, permission });

    const view = await service.approve('user-1', 'msg-1');
    expect(message.update.mock.calls[0][1].status).toBe(MessageStatus.APPROVED);
    expect(view.approvedByName).toBe('Servo');
  });
});

describe('MessageService.reject', () => {
  it('marks the message rejected', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'staff-1', name: 'Servo' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(1) });
    const message = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'msg-1' }) });
    const service = makeService({ message, staff, permission });

    await service.reject('user-1', 'msg-1');
    expect(message.update.mock.calls[0][1].status).toBe(MessageStatus.REJECTED);
  });
});

describe('MessageService.getThread', () => {
  it('forbids a relative reading another relative thread', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ relative });
    await expect(service.getThread('user-1', Role.RELATIVE, 'res-1', 'rel-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('MessageService.getMyConversations', () => {
  it('throws NotFound when no relative profile exists', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ relative });
    await expect(service.getMyConversations('user-1', Role.RELATIVE)).rejects.toBeInstanceOf(NotFoundException);
  });
});
