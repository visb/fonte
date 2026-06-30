import { CalendarClock, MapPin } from 'lucide-react';
import type { Event } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { formatEventDateRange } from '../lib/eventDates';

interface Props {
  event: Event;
}

/** Card só-leitura de um evento interno (story 94), para a equipe de servos. */
export function InternalEventCard({ event }: Props) {
  return (
    <div data-testid="internal-event-card" className="rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{event.title}</h3>
            <Badge
              variant="outline"
              className="font-normal border-amber-500 text-amber-700"
            >
              Interno
            </Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock size={14} />
            {formatEventDateRange(event.startAt, event.endAt)}
          </p>
          {event.location && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={14} />
              {event.location}
            </p>
          )}
        </div>

        {event.bannerUrl && (
          <img
            src={event.bannerUrl}
            alt={`Banner de ${event.title}`}
            className="h-16 w-24 shrink-0 rounded object-cover"
          />
        )}
      </div>

      {event.description && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{event.description}</p>
      )}
    </div>
  );
}
