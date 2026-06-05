import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import type { ListNotificationsParams } from '@fonte/api-client';
import { api, apiOrigin } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';

export function useNotifications(params?: ListNotificationsParams) {
  return useQuery({
    queryKey: params ? [...queryKeys.notifications.all, params] : queryKeys.notifications.all,
    queryFn: () => api.notifications.list(params),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    // No polling — the socket keeps this fresh.
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

/**
 * Opens the realtime channel. On `notification:new`, invalidates the queries.
 * Reconnects when the app returns to the foreground (the socket can drop while
 * backgrounded). Disconnects on logout/unmount. No polling.
 */
export function useNotificationSocket() {
  const { token } = useAuth();
  const invalidate = useNotificationInvalidation();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function connect() {
      const authToken = (await AsyncStorage.getItem('token')) ?? token;
      if (cancelled) return;

      const socket = io(`${apiOrigin}/notifications`, {
        transports: ['websocket'],
        auth: { token: authToken },
        reconnection: true,
      });
      socketRef.current = socket;
      socket.on('notification:new', () => invalidate());
    }

    connect();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const socket = socketRef.current;
        if (socket && !socket.connected) socket.connect();
        // A fresh foreground may have missed pushes — resync.
        invalidate();
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
      const socket = socketRef.current;
      if (socket) {
        socket.off('notification:new');
        socket.disconnect();
      }
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
