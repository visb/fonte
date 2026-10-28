import type { Incident, ResidentFollowUp } from '@fonte/api-client';

/**
 * Ocorrência como chega à aba Acompanhamento. O backend serializa `createdAt`
 * (usado no desempate), mas o contrato não o declara e o item otimista da fila
 * não o tem.
 */
export type TrackingIncident = Incident & { createdAt?: string };

export type TrackingTimelineEntry =
  | { kind: 'followUp'; key: string; date: string; createdAt?: string; followUp: ResidentFollowUp }
  | { kind: 'incident'; key: string; date: string; createdAt?: string; incident: TrackingIncident };

/** Sem `createdAt` = item pendente da fila, o mais recente do dia. */
const NEWEST = '￿';

function dayOf(date: string): string {
  return date.slice(0, 10);
}

function compareDesc(a: TrackingTimelineEntry, b: TrackingTimelineEntry): number {
  const byDate = dayOf(b.date).localeCompare(dayOf(a.date));
  if (byDate !== 0) return byDate;
  const createdA = a.createdAt ?? NEWEST;
  const createdB = b.createdAt ?? NEWEST;
  if (createdA === createdB) return 0;
  return createdA < createdB ? 1 : -1;
}

/**
 * Story 228: follow-ups e ocorrências do filho numa linha do tempo única, por
 * `date` desc e, no mesmo dia, `createdAt` desc. Empate total mantém a ordem de
 * entrada (sort estável): follow-ups antes das ocorrências.
 */
export function mergeTrackingTimeline(
  followUps: ResidentFollowUp[] | undefined,
  incidents: TrackingIncident[] | undefined,
): TrackingTimelineEntry[] {
  const entries: TrackingTimelineEntry[] = [
    ...(followUps ?? []).map((followUp) => ({
      kind: 'followUp' as const,
      key: `follow-up:${followUp.id}`,
      date: followUp.date,
      createdAt: followUp.createdAt,
      followUp,
    })),
    ...(incidents ?? []).map((incident) => ({
      kind: 'incident' as const,
      key: `incident:${incident.id}`,
      date: incident.date,
      createdAt: incident.createdAt,
      incident,
    })),
  ];
  return entries.sort(compareDesc);
}
