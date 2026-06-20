import type { ActivityEvent } from '@fonte/api-client';
import { ActivityEventType } from '@fonte/types';
import { ACTIVITY_EVENT_CONFIG, describeStatusChange } from '../constants';

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}

/** Texto humano do evento (verbo/descrição), com o caso de status detalhado. */
function describe(event: ActivityEvent): string {
  if (event.type === ActivityEventType.STATUS_CHANGED) {
    return describeStatusChange(event.metadata);
  }
  return ACTIVITY_EVENT_CONFIG[event.type]?.label ?? 'registrou um evento';
}

export function HistoryEventItem({ event }: { event: ActivityEvent }) {
  const config = ACTIVITY_EVENT_CONFIG[event.type];
  const Icon = config?.icon;
  const actor = event.actor?.name ?? 'Alguém';

  return (
    <li className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm">
          <span className="font-medium">{actor}</span>{' '}
          <span className="text-muted-foreground">{describe(event)}</span>
        </p>
        <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
      </div>
    </li>
  );
}
