import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import type { Notification } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

interface Props {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: Props) {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleSelect = (notification: Notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    onClose();
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="flex max-h-[28rem] w-80 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Notificações</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || notifications.length === 0}
        >
          <CheckCheck size={14} />
          Marcar todas como lidas
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, 'Erro ao carregar notificações')} />
        ) : notifications.length === 0 ? (
          <EmptyState title="Nenhuma notificação" />
        ) : (
          <div className="space-y-0.5">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onSelect={handleSelect}
                onMarkRead={(id) => markRead.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t px-3 py-2 text-center">
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
        >
          Ver todas
        </Button>
      </div>
    </div>
  );
}
