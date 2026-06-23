import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    notifications: {
      list: vi.fn(),
      unreadCount: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
    },
  },
}));

// socket.io-client e useAuth são importados no topo do módulo; mockados para
// não abrir conexão real. O hook de socket em si não é exercido aqui.
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), disconnect: vi.fn() })), Socket: class {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ token: null }) }));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './useNotifications';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('notificações — queries', () => {
  it('list sem params usa notifications.all', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useNotifications());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.notifications.list).toHaveBeenCalledWith(undefined);
  });

  it('list com params anexa params à queryKey', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue([] as never);
    const params = { unreadOnly: true } as never;
    const { result, queryClient } = renderHookWithClient(() => useNotifications(params));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData([...queryKeys.notifications.all, params])).toEqual([]);
  });

  it('unreadCount extrai o count', async () => {
    vi.mocked(api.notifications.unreadCount).mockResolvedValue({ count: 7 } as never);
    const { result } = renderHookWithClient(() => useUnreadCount());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7);
  });
});

describe('notificações — mutations', () => {
  it('markRead e markAllRead invalidam all + unreadCount', async () => {
    vi.mocked(api.notifications.markRead).mockResolvedValue({} as never);
    vi.mocked(api.notifications.markAllRead).mockResolvedValue({} as never);

    const { result: r, queryClient } = renderHookWithClient(() => useMarkNotificationRead());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    r.current.mutate('n1');
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(api.notifications.markRead).toHaveBeenCalledWith('n1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.notifications.unreadCount });

    const { result: a } = renderHookWithClient(() => useMarkAllNotificationsRead());
    a.current.mutate();
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    expect(api.notifications.markAllRead).toHaveBeenCalled();
  });
});
