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
  user?: ReturnType<typeof makeRepo>;
  sg?: ReturnType<typeof makeRepo>;
  sgMeeting?: ReturnType<typeof makeRepo>;
  sgRelativeCheckin?: ReturnType<typeof makeRepo>;
} = {}) {
  return new MessageService(
    (repos.message ?? makeRepo()) as unknown as Repository<Message>,
    (repos.resident ?? makeRepo()) as unknown as Repository<Resident>,
    (repos.relative ?? makeRepo()) as unknown as Repository<Relative>,
    (repos.staff ?? makeRepo()) as unknown as Repository<Staff>,
    (repos.sg ?? makeRepo()) as unknown as Repository<SupportGroup>,
    (repos.sgMeeting ?? makeRepo()) as unknown as Repository<SupportGroupMeeting>,
    (repos.sgRelativeCheckin ?? makeRepo()) as unknown as Repository<SupportGroupRelativeCheckin>,
    (repos.user ?? makeRepo()) as unknown as Repository<User>,
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

  it('returns the single conversation for a relative with an approved last message', async () => {
    const relative = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'rel-1',
        residentId: 'res-1',
        name: 'Maria',
        photoUrl: 'p.jpg',
        resident: { name: 'Joao' },
      }),
    });
    const message = makeRepo({
      findOne: jest.fn().mockResolvedValue({ content: 'oi', createdAt: new Date('2026-01-01') }),
    });
    const service = makeService({ relative, message });
    const out = await service.getMyConversations('user-1', Role.RELATIVE);
    expect(out).toHaveLength(1);
    expect(out[0].residentName).toBe('Joao');
    expect(out[0].lastMessage).toBe('oi');
    expect(out[0].relativePhotoUrl).toBe('p.jpg');
  });

  it('throws NotFound when no resident profile exists', async () => {
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ resident });
    await expect(service.getMyConversations('user-1', Role.RESIDENT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a conversation per relative for a resident', async () => {
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1', name: 'Joao' }) });
    const relative = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'rel-1', name: 'Maria', photoUrl: null },
        { id: 'rel-2', name: 'Jose', photoUrl: null },
      ]),
    });
    const message = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ resident, relative, message });
    const out = await service.getMyConversations('user-1', Role.RESIDENT);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.relativeName)).toEqual(['Maria', 'Jose']);
  });
});

describe('MessageService.getConversations', () => {
  it('returns [] for non-admin staff without a house', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: null }) });
    const service = makeService({ staff });
    expect(await service.getConversations('user-1', Role.SERVANT)).toEqual([]);
  });

  it('returns [] for admin with no residents', async () => {
    const resident = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const service = makeService({ resident });
    expect(await service.getConversations('user-1', Role.ADMIN)).toEqual([]);
  });

  it('builds conversations for admin with residents, relatives and pending counts', async () => {
    const resident = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'res-1', name: 'Joao', houseId: 'h1', house: { name: 'Casa 1' } },
      ]),
    });
    const relative = makeRepo({
      find: jest.fn().mockResolvedValue([{ id: 'rel-1', residentId: 'res-1', name: 'Maria', photoUrl: null }]),
    });
    const message = makeRepo({
      find: jest.fn().mockResolvedValue([{ attachmentType: 'image', createdAt: new Date('2026-02-02') }]),
      count: jest.fn().mockResolvedValue(3),
    });
    const service = makeService({ resident, relative, message });
    const out = await service.getConversations('user-1', Role.ADMIN);
    expect(out).toHaveLength(1);
    expect(out[0].pendingCount).toBe(3);
    expect(out[0].houseName).toBe('Casa 1');
    expect(out[0].lastMessage).toBe('📷 Imagem');
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

  it('forbids a resident reading another resident thread', async () => {
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ resident });
    await expect(service.getThread('user-1', Role.RESIDENT, 'res-1', 'rel-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns staff thread enriched with sender names and profile types', async () => {
    const msgs = [
      { id: 'm1', senderUserId: 'u-staff', approvedByUserId: 'u-staff', status: MessageStatus.APPROVED },
      { id: 'm2', senderUserId: 'u-rel', approvedByUserId: null, status: MessageStatus.APPROVED },
    ];
    const message = makeRepo({ find: jest.fn().mockResolvedValue(msgs) });
    const user = makeRepo({
      findByIds: jest.fn().mockResolvedValue([
        { id: 'u-staff', email: 's@x.com' },
        { id: 'u-rel', email: 'r@x.com' },
      ]),
    });
    const staff = makeRepo({ find: jest.fn().mockResolvedValue([{ userId: 'u-staff', name: 'Servo' }]) });
    const relative = makeRepo({ find: jest.fn().mockResolvedValue([{ userId: 'u-rel', name: 'Maria' }]) });
    const service = makeService({ message, user, staff, relative });
    const out = await service.getThread('admin', Role.ADMIN, 'res-1', 'rel-1');
    expect(out).toHaveLength(2);
    expect(out[0].senderName).toBe('Servo');
    expect(out[0].senderProfileType).toBe('STAFF');
    expect(out[0].approvedByName).toBe('Servo');
    expect(out[1].senderName).toBe('Maria');
    expect(out[1].senderProfileType).toBe('RELATIVE');
  });

  it('filters out non-approved messages from other senders for a resident', async () => {
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1' }) });
    const msgs = [
      { id: 'm1', senderUserId: 'u-1', approvedByUserId: null, status: MessageStatus.APPROVED },
      { id: 'm2', senderUserId: 'other', approvedByUserId: null, status: MessageStatus.PENDING_APPROVAL },
      { id: 'm3', senderUserId: 'u-1', approvedByUserId: null, status: MessageStatus.PENDING_APPROVAL },
    ];
    const message = makeRepo({ find: jest.fn().mockResolvedValue(msgs) });
    const service = makeService({ resident, message });
    const out = await service.getThread('u-1', Role.RESIDENT, 'res-1', 'rel-1');
    expect(out.map((m) => m.id)).toEqual(['m1', 'm3']);
  });
});

describe('MessageService.getPending', () => {
  it('returns [] when staff has no house', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: null }) });
    const service = makeService({ staff });
    expect(await service.getPending('user-1')).toEqual([]);
  });

  it('returns [] when staff lacks moderate permission', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: 'h1' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService({ staff, permission });
    expect(await service.getPending('user-1')).toEqual([]);
  });

  it('lists pending messages with sender/recipient names', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: 'h1' }) });
    const permission = makeRepo({ count: jest.fn().mockResolvedValue(1) });
    const resident = makeRepo({
      find: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'res-1', name: 'Joao' }]) // residents in house
        .mockResolvedValueOnce([]) // residentBySender
        .mockResolvedValue([]),
    });
    const relative = makeRepo({
      find: jest
        .fn()
        .mockResolvedValueOnce([{ userId: 'u-rel', name: 'Maria' }]) // relativeBySender
        .mockResolvedValueOnce([{ id: 'rel-1', name: 'Maria' }]), // allRelatives
    });
    const message = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'm1', senderUserId: 'u-rel', residentId: 'res-1', relativeId: 'rel-1', status: MessageStatus.PENDING_APPROVAL },
      ]),
    });
    const service = makeService({ staff, permission, resident, relative, message });
    const out = await service.getPending('user-1');
    expect(out).toHaveLength(1);
    expect(out[0].senderName).toBe('Maria');
    // sender is a relative => recipient is the resident
    expect(out[0].recipientName).toBe('Joao');
  });
});

describe('MessageService.getHouseStaffThreads', () => {
  it('throws NotFound when the relative is missing', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ relative });
    await expect(service.getHouseStaffThreads('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only staff permitted to message families', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }) });
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1', houseId: 'h1' }) });
    const staff = makeRepo({
      find: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 's1', name: 'Servo Um', photoUrl: null },
          { id: 's2', name: 'Servo Dois', photoUrl: null },
        ]) // houseStaff
        .mockResolvedValue([]), // coordinators
    });
    const permission = makeRepo({
      find: jest.fn().mockResolvedValue([{ staffId: 's1' }]),
    });
    const message = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ relative, resident, staff, permission, message });
    const out = await service.getHouseStaffThreads('user-1');
    expect(out.map((t) => t.staffId)).toEqual(['s1']);
  });
});

describe('MessageService.getDirectConversations', () => {
  function qb(rows: unknown[]) {
    const builder: Record<string, jest.Mock> = {};
    for (const m of ['select', 'addSelect', 'where', 'groupBy', 'addGroupBy']) {
      builder[m] = jest.fn().mockReturnValue(builder);
    }
    builder.getRawMany = jest.fn().mockResolvedValue(rows);
    return builder;
  }

  it('admin lists all staff/relative pairs', async () => {
    const message = makeRepo({
      createQueryBuilder: jest.fn().mockReturnValue(qb([{ staffId: 's1', relativeId: 'rel-1' }])),
      findOne: jest.fn().mockResolvedValue(null),
    });
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', name: 'Servo' }) });
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', name: 'Maria', residentId: 'res-1' }) });
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1', name: 'Joao' }) });
    const service = makeService({ message, staff, relative, resident });
    const out = await service.getDirectConversations('admin', Role.ADMIN);
    expect(out).toHaveLength(1);
    expect(out[0].staffName).toBe('Servo');
    expect(out[0].residentName).toBe('Joao');
  });

  it('coordinator without a house returns []', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: null }) });
    const service = makeService({ staff });
    expect(await service.getDirectConversations('user-1', Role.COORDINATOR)).toEqual([]);
  });

  it('servant lists only own conversations', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: 'h1' }) });
    const message = makeRepo({
      createQueryBuilder: jest.fn().mockReturnValue(qb([{ relativeId: 'rel-1' }])),
      findOne: jest.fn().mockResolvedValue(null),
    });
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', name: 'Maria', residentId: 'res-1' }) });
    const service = makeService({ staff, message, relative });
    const out = await service.getDirectConversations('user-1', Role.SERVANT);
    expect(out).toHaveLength(1);
    expect(out[0].staffId).toBe('s1');
  });

  it('servant without house nor support group returns []', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: null, supportGroupId: null }) });
    const service = makeService({ staff });
    expect(await service.getDirectConversations('user-1', Role.SERVANT)).toEqual([]);
  });
});

describe('MessageService.getDirectThread', () => {
  it('forbids a relative reading another relative thread', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ relative });
    await expect(service.getDirectThread('user-1', Role.RELATIVE, 's1', 'rel-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('forbids staff reading a thread for another staff', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ staff });
    await expect(service.getDirectThread('user-1', Role.SERVANT, 's1', 'rel-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns [] when the thread has no messages', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1' }) });
    const message = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const service = makeService({ staff, message });
    expect(await service.getDirectThread('user-1', Role.SERVANT, 's1', 'rel-1')).toEqual([]);
  });

  it('maps sender names for an existing thread', async () => {
    const staff = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 's1' }),
      find: jest.fn().mockResolvedValue([{ userId: 'u-staff', name: 'Servo' }]),
    });
    const message = makeRepo({
      find: jest.fn().mockResolvedValue([{ id: 'm1', senderUserId: 'u-staff' }]),
    });
    const relative = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const service = makeService({ staff, message, relative });
    const out = await service.getDirectThread('user-1', Role.SERVANT, 's1', 'rel-1');
    expect(out[0].senderName).toBe('Servo');
  });
});

describe('MessageService.sendDirect', () => {
  it('forbids a relative sending as another relative', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ relative });
    await expect(
      service.sendDirect('user-1', ProfileType.RELATIVE, { staffId: 's1', relativeId: 'rel-1', content: 'oi' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids a relative messaging a staff from another house', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }) });
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1', houseId: 'h1' }) });
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: 'h2' }) });
    const service = makeService({ relative, resident, staff });
    await expect(
      service.sendDirect('user-1', ProfileType.RELATIVE, { staffId: 's1', relativeId: 'rel-1', content: 'oi' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('relative messages a same-house staff successfully (approved)', async () => {
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }) });
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1', houseId: 'h1' }) });
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: 'h1' }) });
    const message = makeRepo();
    const service = makeService({ relative, resident, staff, message });
    await service.sendDirect('user-1', ProfileType.RELATIVE, { staffId: 's1', relativeId: 'rel-1', content: 'oi' } as never);
    expect(message.create.mock.calls[0][0].status).toBe(MessageStatus.APPROVED);
    expect(message.create.mock.calls[0][0].residentId).toBeNull();
  });

  it('forbids staff sending as another staff', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'other' }) });
    const service = makeService({ staff });
    await expect(
      service.sendDirect('user-1', ProfileType.STAFF, { staffId: 's1', relativeId: 'rel-1', content: 'oi' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('staff NotFound when the target relative does not exist', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: 'h1' }) });
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService({ staff, relative });
    await expect(
      service.sendDirect('user-1', ProfileType.STAFF, { staffId: 's1', relativeId: 'rel-1', content: 'oi' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an empty direct message', async () => {
    const staff = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: 'h1' }) });
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }) });
    const resident = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'res-1', houseId: 'h1' }) });
    const service = makeService({ staff, relative, resident });
    await expect(
      service.sendDirect('user-1', ProfileType.STAFF, { staffId: 's1', relativeId: 'rel-1' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('support-group coordinator staff can message any relative', async () => {
    const staff = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 's1', houseId: null, supportGroupId: null }),
    });
    const relative = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rel-1', residentId: 'res-1' }) });
    const sg = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'sg-1', coordinatorId: 's1' }) });
    const message = makeRepo();
    const service = makeService({ staff, relative, sg, message });
    await service.sendDirect('user-1', ProfileType.STAFF, { staffId: 's1', relativeId: 'rel-1', content: 'oi' } as never);
    expect(message.save).toHaveBeenCalled();
  });
});
