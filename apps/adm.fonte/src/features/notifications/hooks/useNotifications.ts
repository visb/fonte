import { useEffect } from 'react';
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

// ─── Shared socket connection ────────────────────────────────────────────────
// One socket per token, ref-counted across subscribers. The disconnect is
// deferred so React StrictMode's mount→cleanup→mount cycle (dev) reuses the same
// connection instead of tearing it down mid-handshake ("WebSocket is closed
// before the connection is established").

let sharedSocket: Socket | null = null;
let sharedToken: string | null = null;
let refCount = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

function acquireNotificationSocket(token: string, onNew: () => void): () => void {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (!sharedSocket || sharedToken !== token) {
    if (sharedSocket) sharedSocket.disconnect();
    sharedSocket = io(`${SOCKET_ORIGIN}/notifications`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    });
    sharedToken = token;
  }

  const socket = sharedSocket;
  refCount += 1;
  socket.on('notification:new', onNew);

  return () => {
    socket.off('notification:new', onNew);
    refCount -= 1;
    if (refCount <= 0) {
      disconnectTimer = setTimeout(() => {
        if (refCount <= 0 && sharedSocket) {
          sharedSocket.disconnect();
          sharedSocket = null;
          sharedToken = null;
        }
        disconnectTimer = null;
      }, 1000);
    }
  };
}

/**
 * Subscribes to the realtime channel. On `notification:new`, invalidates the
 * list and unread-count queries. Shares one connection across mounts. No polling.
 */
export function useNotificationSocket() {
  const { token } = useAuth();
  const invalidate = useNotificationInvalidation();

  useEffect(() => {
    if (!token) return;
    const release = acquireNotificationSocket(token, () => invalidate());
    return release;
    // invalidate is stable enough; re-run only when the token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
