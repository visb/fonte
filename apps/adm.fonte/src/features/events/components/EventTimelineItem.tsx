import { CalendarClock, MapPin, Pencil, Trash2, Users } from 'lucide-react';
import type { Event } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatEventDateRange } from '../lib/eventDates';

interface Props {
  event: Event;
  highlighted: boolean;
  past: boolean;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

export function EventTimelineItem({ event, highlighted, past, onEdit, onDelete }: Props) {
  return (
    <div className="relative pl-8">
      {/* Marcador da timeline */}
      <span
        className={cn(
          'absolute left-2 top-4 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background',
          highlighted ? 'bg-primary' : 'bg-muted-foreground',
        )}
      />

      <div
        data-testid="event-item"
        data-highlighted={highlighted ? 'true' : 'false'}
        data-past={past ? 'true' : 'false'}
        className={cn(
          'rounded-md border bg-card p-4 transition-colors',
          highlighted && 'border-primary ring-1 ring-primary/40 shadow-sm',
          past && 'opacity-60',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{event.title}</h3>
              {highlighted && <Badge>Próximo</Badge>}
              {past && (
                <Badge variant="secondary" className="font-normal">
                  Encerrado
                </Badge>
              )}
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
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users size={14} />
              {event.capacity != null ? `${event.capacity} vagas` : 'Vagas ilimitadas'}
            </p>
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
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(event)}>
            <Pencil size={14} className="mr-1.5" />
            Editar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(event)}>
            <Trash2 size={14} className="mr-1.5" />
            Remover
          </Button>
        </div>
      </div>
    </div>
  );
}
