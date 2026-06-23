import { waitFor } from '@testing-library/react-native';

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
};
const mockIo = jest.fn(() => mockSocket);
jest.mock('socket.io-client', () => ({ io: (...a: unknown[]) => mockIo(...a), Socket: class {} }));

jest.mock('@/lib/api', () => ({
  api: {
    notifications: {
      list: jest.fn(),
      unreadCount: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    },
  },
  apiOrigin: 'http://localhost:3000',
}));

const mockUseAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ useAuth: () => mockUseAuth() }));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationSocket,
} from './useNotifications';

const m = api as unknown as { notifications: Record<string, jest.Mock> };

beforeEach(() => {
  jest.clearAllMocks();
  mockSocket.connected = false;
  mockUseAuth.mockReturnValue({ token: null });
});

describe('useNotifications — queries', () => {
  it('lista com params (queryKey inclui params)', async () => {
    m.notifications.list.mockResolvedValue([{ id: 'n1' }]);
    const { result } = renderHookWithClient(() => useNotifications({ unreadOnly: true } as never));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.notifications.list).toHaveBeenCalledWith({ unreadOnly: true });
  });

  it('lista sem params', async () => {
    m.notifications.list.mockResolvedValue([]);
    const { result } = renderHookWithClient(() => useNotifications());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.notifications.list).toHaveBeenCalledWith(undefined);
  });

  it('useUnreadCount mapeia para o número', async () => {
    m.notifications.unreadCount.mockResolvedValue({ count: 7 });
    const { result } = renderHookWithClient(() => useUnreadCount());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7);
  });
});

describe('useNotifications — mutations', () => {
  it('useMarkNotificationRead marca uma como lida', async () => {
    m.notifications.markRead.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useMarkNotificationRead());
    result.current.mutate('n1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.notifications.markRead).toHaveBeenCalledWith('n1');
  });

  it('useMarkAllNotificationsRead marca todas', async () => {
    m.notifications.markAllRead.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useMarkAllNotificationsRead());
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.notifications.markAllRead).toHaveBeenCalled();
  });
});

describe('useNotificationSocket', () => {
  it('sem token não abre socket', () => {
    mockUseAuth.mockReturnValue({ token: null });
    renderHookWithClient(() => useNotificationSocket());
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('com token abre o canal /notifications e escuta notification:new', async () => {
    mockUseAuth.mockReturnValue({ token: 'jwt-abc' });
    renderHookWithClient(() => useNotificationSocket());
    await waitFor(() => expect(mockIo).toHaveBeenCalled());
    expect(mockIo).toHaveBeenCalledWith(
      'http://localhost:3000/notifications',
      expect.objectContaining({ transports: ['websocket'] }),
    );
    expect(mockSocket.on).toHaveBeenCalledWith('notification:new', expect.any(Function));
  });

  it('desmontar desconecta o socket', async () => {
    mockUseAuth.mockReturnValue({ token: 'jwt-abc' });
    const { unmount } = renderHookWithClient(() => useNotificationSocket());
    await waitFor(() => expect(mockIo).toHaveBeenCalled());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
