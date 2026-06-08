import { Repository } from 'typeorm';
import { NotificationType, ReceivableStatus, Role } from '@fonte/types';
import { NotificationScheduler } from './notification.scheduler';
import { NotificationService } from './notification.service';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';

function makeReceivable(overrides: Partial<ResidentReceivable> = {}): ResidentReceivable {
  return {
    id: 'rcv-1',
    residentId: 'res-1',
    dueDate: '2020-01-10' as unknown as Date,
    status: ReceivableStatus.PENDING,
    resident: { name: 'João' },
    ...overrides,
  } as ResidentReceivable;
}

function makeReceivableRepo(found: ResidentReceivable[]) {
  return {
    find: jest.fn().mockResolvedValue(found),
  } as unknown as Repository<ResidentReceivable>;
}

function makeNotifications(existsValues: boolean[] = []) {
  let i = 0;
  return {
    create: jest.fn().mockResolvedValue(undefined),
    existsForResidentSince: jest.fn().mockImplementation(() => {
      const v = existsValues[i] ?? false;
      i += 1;
      return Promise.resolve(v);
    }),
  } as unknown as NotificationService & {
    create: jest.Mock;
    existsForResidentSince: jest.Mock;
  };
}

describe('NotificationScheduler.runOverdueReceivablesCheck', () => {
  it('emits RECEIVABLE_OVERDUE to ADMIN for an overdue PENDING installment', async () => {
    const repo = makeReceivableRepo([makeReceivable()]);
    const notifications = makeNotifications([false]);
    const scheduler = new NotificationScheduler(repo, notifications);

    const result = await scheduler.runOverdueReceivablesCheck();

    expect(result.created).toBe(1);
    const arg = (notifications.create as jest.Mock).mock.calls[0][0];
    expect(arg.type).toBe(NotificationType.RECEIVABLE_OVERDUE);
    expect(arg.recipientRole).toBe(Role.ADMIN);
    expect(arg.metadata.residentId).toBe('res-1');
    expect(arg.metadata.count).toBe(1);
  });

  it('groups multiple overdue installments of one resident into a single notification', async () => {
    const repo = makeReceivableRepo([
      makeReceivable({ id: 'rcv-1', dueDate: '2020-03-10' as unknown as Date }),
      makeReceivable({ id: 'rcv-2', dueDate: '2020-01-10' as unknown as Date }),
      makeReceivable({ id: 'rcv-3', dueDate: '2020-02-10' as unknown as Date }),
    ]);
    const notifications = makeNotifications([false]);
    const scheduler = new NotificationScheduler(repo, notifications);

    const result = await scheduler.runOverdueReceivablesCheck();

    expect(result.created).toBe(1);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    const arg = (notifications.create as jest.Mock).mock.calls[0][0];
    expect(arg.metadata.count).toBe(3);
    expect(arg.metadata.oldestDueDate).toBe('2020-01-10');
    expect(notifications.existsForResidentSince).toHaveBeenCalledTimes(1);
  });

  it('emits one notification per distinct resident', async () => {
    const repo = makeReceivableRepo([
      makeReceivable({ id: 'rcv-1', residentId: 'res-1' }),
      makeReceivable({ id: 'rcv-2', residentId: 'res-2' }),
    ]);
    const notifications = makeNotifications([false, false]);
    const scheduler = new NotificationScheduler(repo, notifications);

    const result = await scheduler.runOverdueReceivablesCheck();

    expect(result.created).toBe(2);
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('is idempotent — skips when a notification already exists in the window', async () => {
    const repo = makeReceivableRepo([makeReceivable()]);
    const notifications = makeNotifications([true]);
    const scheduler = new NotificationScheduler(repo, notifications);

    const result = await scheduler.runOverdueReceivablesCheck();

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('does not create anything when there are no overdue installments', async () => {
    const repo = makeReceivableRepo([]);
    const notifications = makeNotifications();
    const scheduler = new NotificationScheduler(repo, notifications);

    const result = await scheduler.runOverdueReceivablesCheck();

    expect(result.created).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
