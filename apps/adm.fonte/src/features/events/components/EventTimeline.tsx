import type { Event } from '@fonte/api-client';
import { classifyEvents } from '../lib/eventTimeline';
import { EventTimelineItem } from './EventTimelineItem';

interface Props {
  events: Event[];
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

export function EventTimeline({ events, onEdit, onDelete }: Props) {
  const { highlightedIds, pastIds } = classifyEvents(events, new Date());

  return (
    <div className="relative space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
      {events.map((event) => (
        <EventTimelineItem
          key={event.id}
          event={event}
          highlighted={highlightedIds.has(event.id)}
          past={pastIds.has(event.id)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
