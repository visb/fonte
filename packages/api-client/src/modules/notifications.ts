import type { AxiosInstance } from 'axios';
import type {
  Notification,
  UnreadCountResponse,
  ListNotificationsParams,
} from '../types.js';

export function createNotificationsModule(http: AxiosInstance) {
  return {
    list: (params?: ListNotificationsParams) =>
      http
        .get<Notification[]>('/notifications', {
          params: {
            unreadOnly: params?.unreadOnly ? 'true' : undefined,
            page: params?.page,
          },
        })
        .then((r) => r.data),
    unreadCount: () =>
      http
        .get<UnreadCountResponse>('/notifications/unread-count')
        .then((r) => r.data),
    markRead: (id: string) =>
      http
        .patch<{ success: boolean }>(`/notifications/${id}/read`)
        .then((r) => r.data),
    markAllRead: () =>
      http
        .patch<{ success: boolean }>('/notifications/read-all')
        .then((r) => r.data),
  };
}
