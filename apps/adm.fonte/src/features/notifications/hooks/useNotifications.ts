import { useEffect, useRef } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import type { ListNotificationsParams } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications(params?: ListNotificationsParams) {
  return useQuery({
    queryKey: params ? [...queryKeys.notifications.all, params] : queryKeys.notifications.all,
    queryFn: () => api.notifications.list(params),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    // No refetchInterval — kept fresh by the socket push.
    queryFn: () => api.notifications.unreadCount().then((r) => r.count),
  });
}

function useNotificationInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: invalidate,
  });
}

const SOCKET_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/api\/v\d+\/?$/,
  '',
);

/**
 * Opens the realtime channel once. On `notification:new`, invalidates the list
 * and unread-count queries. Disconnects on logout/unmount. No polling.
 */
export function useNotificationSocket() {
  const { token } = useAuth();
  const invalidate = useNotificationInvalidation();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(`${SOCKET_ORIGIN}/notifications`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('notification:new', () => invalidate());

    return () => {
      socket.off('notification:new');
      socket.disconnect();
      socketRef.current = null;
    };
    // invalidate is stable enough; re-run only when the token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
