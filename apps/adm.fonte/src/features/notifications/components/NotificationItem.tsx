import { Check } from 'lucide-react';
import { NotificationType, type Notification } from '@fonte/api-client';
import { cn } from '@/lib/utils';
import { relativeTime } from '../lib/relativeTime';
import { CapacityRequestActions } from './CapacityRequestActions';
import { CensusReviewActions } from './CensusReviewActions';

interface Props {
  notification: Notification;
  onSelect: (notification: Notification) => void;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ notification, onSelect, onMarkRead }: Props) {
  const isCapacityRequest =
    notification.type === NotificationType.CAPACITY_CHANGE_REQUESTED;
  const isCensusConcluded =
    notification.type === NotificationType.CENSUS_CONCLUDED;

  return (
    <div className={cn('group relative rounded-md', !notification.read && 'bg-accent/40')}>
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="w-full text-left px-3 py-2.5 pr-9 rounded-md transition-colors hover:bg-accent"
      >
        <div className="flex items-start gap-2">
          {!notification.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className={cn('text-sm truncate', !notification.read && 'font-medium')}>
                {notification.title}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(notification.createdAt)}
              </span>
            </div>
            {notification.body && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {notification.body}
              </p>
            )}
          </div>
        </div>
      </button>

      {!notification.read && (
        <button
          type="button"
          onClick={() => onMarkRead(notification.id)}
          title="Marcar como lida"
          aria-label="Marcar como lida"
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus:opacity-100 group-hover:opacity-100"
        >
          <Check size={14} />
        </button>
      )}

      {isCapacityRequest && <CapacityRequestActions notification={notification} />}
      {isCensusConcluded && <CensusReviewActions notification={notification} />}
    </div>
  );
}
