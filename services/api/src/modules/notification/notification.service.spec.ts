import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationType, Role } from '@fonte/types';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { NotificationRead } from './notification-read.entity';
import { Staff } from '../staff/staff.entity';
import { NOTIFICATION_CREATED_EVENT } from './notification.events';

/**
 * Chainable query-builder stub. Every chained call returns `this`; terminal
 * methods (`getMany`, `getCount`, `getRawAndEntities`) resolve to canned data.
 */
function makeQb(result: {
  entities?: Notification[];
  raw?: Array<Record<string, unknown>>;
  count?: number;
}) {
  const qb: Record<string, jest.Mock> = {};
  const chain = ['where', 'andWhere', 'orWhere', 'leftJoin', 'addSelect', 'orderBy', 'take', 'skip'];
  for (const m of chain) qb[m] = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue(result.entities ?? []);
  qb.getCount = jest.fn().mockResolvedValue(result.count ?? 0);
  qb.getRawAndEntities = jest.fn().mockResolvedValue({
    entities: result.entities ?? [],
    raw: result.raw ?? [],
  });
  return qb;
}

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'notif-1', createdAt: new Date(), ...v })),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

function makeReadsRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeStaffRepo(houseId: string | null = null) {
  return {
    findOne: jest.fn().mockResolvedValue(houseId ? { houseId } : null),
  };
}

function makeEmitter() {
  return { emit: jest.fn() };
}

function makeService(
  repo: ReturnType<typeof makeRepo>,
  readsRepo = makeReadsRepo(),
  staffRepo = makeStaffRepo(),
  emitter = makeEmitter(),
) {
  return new NotificationService(
    repo as unknown as Repository<Notification>,
    readsRepo as unknown as Repository<NotificationRead>,
    staffRepo as unknown as Repository<Staff>,
    emitter as never,
  );
}

const adminUser = { userId: 'admin-1', role: Role.ADMIN, houseId: null };
const houseUser = { userId: 'coord-1', role: Role.COORDINATOR, houseId: 'house-1' };

describe('NotificationService.create', () => {
  it('persists the notification and emits the realtime event with the right rooms', async () => {
    const repo = makeRepo();
    const emitter = makeEmitter();
    const service = makeService(repo, makeReadsRepo(), makeStaffRepo(), emitter);

    await service.create({
      type: NotificationType.INCIDENT_CREATED,
      title: 'Nova ocorrência',
      houseId: 'house-9',
      recipientRole: Role.ADMIN,
    });

    expect(repo.save).toHaveBeenCalled();
    expect(emitter.emit).toHaveBeenCalledWith(
      NOTIFICATION_CREATED_EVENT,
      expect.objectContaining({
        rooms: expect.arrayContaining(['role:ADMIN', 'house:house-9']),
      }),
    );
  });

  it('targets the user room when recipientId is set', async () => {
    const repo = makeRepo({
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'n1', createdAt: new Date(), ...v })),
    });
    const emitter = makeEmitter();
    const service = makeService(repo, makeReadsRepo(), makeStaffRepo(), emitter);

    await service.create({
      type: NotificationType.PAYMENT_REGISTERED,
      title: 'Pago',
      recipientId: 'user-42',
    });

    const event = emitter.emit.mock.calls[0][1];
    expect(event.rooms).toEqual(['user:user-42']);
  });
});

describe('NotificationService.listForUser', () => {
  const adminNotif = {
    id: 'n1', type: NotificationType.RECEIVABLE_OVERDUE, title: 't', body: null, link: null,
    metadata: null, recipientId: null, recipientRole: Role.ADMIN, houseId: null, createdAt: new Date(),
  } as Notification;

  it('resolves target by recipientRole and computes read=false when no read row', async () => {
    const qb = makeQb({ entities: [adminNotif] });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    const result = await service.listForUser(adminUser);

    expect(result).toHaveLength(1);
    expect(result[0].read).toBe(false);
    expect(result[0].recipientRole).toBe(Role.ADMIN);
  });

  it('marks read=true when a notification_reads row exists for the user', async () => {
    const qb = makeQb({ entities: [adminNotif] });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const readsRepo = makeReadsRepo({
      find: jest.fn().mockResolvedValue([{ notificationId: 'n1' }]),
    });
    const service = makeService(repo, readsRepo);

    const result = await service.listForUser(adminUser);
    expect(result[0].read).toBe(true);
  });

  it('resolves houseId from Staff for a house-scoped user', async () => {
    const qb = makeQb({ entities: [] });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const staffRepo = makeStaffRepo('house-77');
    const service = makeService(repo, makeReadsRepo(), staffRepo);

    await service.listForUser({ userId: 'u', role: Role.SERVANT });

    // houseId is not on the JWT — must be resolved from the Staff record.
    expect(staffRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'u' } });
    expect(qb.getMany).toHaveBeenCalled();
  });

  it('applies the unread-only filter via a NOT EXISTS predicate', async () => {
    const qb = makeQb({ entities: [] });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    await service.listForUser(houseUser, { unreadOnly: true });

    const calls = JSON.stringify(qb.andWhere.mock.calls);
    expect(calls).toContain('NOT EXISTS');
  });
});

describe('NotificationService.unreadCount', () => {
  it('returns the count of notifications without a read row', async () => {
    const qb = makeQb({ count: 3 });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    await expect(service.unreadCount(adminUser)).resolves.toBe(3);
  });
});

describe('NotificationService.markRead', () => {
  it('throws NotFound when the notification does not exist', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo);
    await expect(service.markRead('missing', adminUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('inserts a notification_reads row for the user', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'n1' }) });
    const readsRepo = makeReadsRepo();
    const service = makeService(repo, readsRepo);

    await service.markRead('n1', adminUser);

    expect(readsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 'n1', userId: 'admin-1' }),
    );
  });

  it('is idempotent — does not duplicate an existing read', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'n1' }) });
    const readsRepo = makeReadsRepo({ findOne: jest.fn().mockResolvedValue({ id: 'r1' }) });
    const service = makeService(repo, readsRepo);

    await service.markRead('n1', adminUser);

    expect(readsRepo.save).not.toHaveBeenCalled();
  });
});

describe('NotificationService.markAllRead', () => {
  it('creates read rows for every unread targeted notification', async () => {
    const unread = [{ id: 'n1' }, { id: 'n2' }] as Notification[];
    const qb = makeQb({ entities: unread });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const readsRepo = makeReadsRepo();
    const service = makeService(repo, readsRepo);

    await service.markAllRead(adminUser);

    expect(readsRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ notificationId: 'n1', userId: 'admin-1' }),
      expect.objectContaining({ notificationId: 'n2', userId: 'admin-1' }),
    ]);
  });

  it('does nothing when there are no unread notifications', async () => {
    const qb = makeQb({ entities: [] });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const readsRepo = makeReadsRepo();
    const service = makeService(repo, readsRepo);

    await service.markAllRead(adminUser);
    expect(readsRepo.save).not.toHaveBeenCalled();
  });
});

describe('NotificationService.existsForEntitySince', () => {
  it('returns true when a matching notification already exists in the window', async () => {
    const qb = makeQb({ count: 1 });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    await expect(
      service.existsForEntitySince(NotificationType.RECEIVABLE_OVERDUE, 'rcv-1', new Date()),
    ).resolves.toBe(true);
  });

  it('returns false when none exist', async () => {
    const qb = makeQb({ count: 0 });
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(repo);

    await expect(
      service.existsForEntitySince(NotificationType.RECEIVABLE_OVERDUE, 'rcv-1', new Date()),
    ).resolves.toBe(false);
  });
});
