import { Role } from '@fonte/types';
import { NotificationController } from './notification.controller';

function svc() {
  return {
    listForUser: jest.fn().mockResolvedValue({ items: [], page: 1 }),
    unreadCount: jest.fn().mockResolvedValue(3),
    markRead: jest.fn().mockResolvedValue(undefined),
    markAllRead: jest.fn().mockResolvedValue(undefined),
  };
}
const user = { userId: 'u1', role: Role.ADMIN };

beforeEach(() => jest.clearAllMocks());

describe('NotificationController', () => {
  it('list maps unreadOnly flag and page', async () => {
    const s = svc();
    const c = new NotificationController(s as never);
    await c.list(user as never, { unreadOnly: 'true', page: 2 } as never);
    expect(s.listForUser).toHaveBeenCalledWith({ userId: 'u1', role: Role.ADMIN }, { unreadOnly: true, page: 2 });
  });

  it('list treats anything but "true" as false', async () => {
    const s = svc();
    const c = new NotificationController(s as never);
    await c.list(user as never, { unreadOnly: 'false', page: 1 } as never);
    expect(s.listForUser).toHaveBeenCalledWith(expect.anything(), { unreadOnly: false, page: 1 });
  });

  it('unreadCount wraps the count', async () => {
    const c = new NotificationController(svc() as never);
    await expect(c.unreadCount(user as never)).resolves.toEqual({ count: 3 });
  });

  it('markRead and markAllRead return success', async () => {
    const s = svc();
    const c = new NotificationController(s as never);
    await expect(c.markRead(user as never, 'n1')).resolves.toEqual({ success: true });
    await expect(c.markAllRead(user as never)).resolves.toEqual({ success: true });
    expect(s.markRead).toHaveBeenCalledWith('n1', { userId: 'u1', role: Role.ADMIN });
  });
});
