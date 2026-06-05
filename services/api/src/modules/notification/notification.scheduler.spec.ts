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
    existsForEntitySince: jest.fn().mockImplementation(() => {
      const v = existsValues[i] ?? false;
      i += 1;
      return Promise.resolve(v);
    }),
  } as unknown as NotificationService & {
    create: jest.Mock;
    existsForEntitySince: jest.Mock;
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
    expect(arg.metadata.entityId).toBe('rcv-1');
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
