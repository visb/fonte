import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import type { Notification } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../hooks/useNotifications';
import { NotificationItem } from '../components/NotificationItem';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleSelect = (notification: Notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Notificações"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || notifications.length === 0}
          >
            <CheckCheck size={16} />
            Marcar todas como lidas
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error, 'Erro ao carregar notificações')} />
      ) : notifications.length === 0 ? (
        <EmptyState title="Nenhuma notificação" />
      ) : (
        <div className="space-y-1 rounded-lg border p-2">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
