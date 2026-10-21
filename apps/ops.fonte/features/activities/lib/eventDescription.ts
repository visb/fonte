import { ActivityEventType, ActivityStatus } from '@fonte/types';
import type { ActivityEvent } from '@fonte/api-client';
import {
  ACTIVITY_EVENT_CONFIG,
  ACTIVITY_STATUS_LABELS,
  REMOVED_STAFF_LABEL,
} from '@/features/activities/constants';

/** Resolve o nome de um servo pelo id (staff da casa), com fallback. */
export type StaffNameResolver = (staffId: string) => string | undefined;

function staffName(id: string, resolve: StaffNameResolver): string {
  return resolve(id) ?? REMOVED_STAFF_LABEL;
}

/** "moveu de Solicitações para A fazer"; sem metadado cai no verbo genérico. */
function describeStatusChange(metadata: ActivityEvent['metadata']): string {
  const meta = metadata as { from?: ActivityStatus; to?: ActivityStatus } | null;
  if (!meta?.from || !meta?.to) return ACTIVITY_EVENT_CONFIG.STATUS_CHANGED.label;
  const from = ACTIVITY_STATUS_LABELS[meta.from] ?? meta.from;
  const to = ACTIVITY_STATUS_LABELS[meta.to] ?? meta.to;
  return `moveu de ${from} para ${to}`;
}

/**
 * Story 220: a atribuição aparece como "atribuiu a Fulano" (de ninguém) e a
 * troca como "trocou o responsável de X para Y". `metadata` traz staff ids.
 */
function describeResponsibleChange(
  metadata: ActivityEvent['metadata'],
  resolve: StaffNameResolver,
): string {
  const meta = metadata as { from?: string | null; to?: string | null } | null;
  const from = meta?.from ?? null;
  const to = meta?.to ?? null;
  if (!from && to) return `atribuiu a ${staffName(to, resolve)}`;
  if (from && to) {
    return `trocou o responsável de ${staffName(from, resolve)} para ${staffName(to, resolve)}`;
  }
  if (from && !to) return `removeu o responsável ${staffName(from, resolve)}`;
  return ACTIVITY_EVENT_CONFIG.RESPONSIBLE_CHANGED.label;
}

/** Texto do evento sem o ator (renderizado à parte). */
export function describeActivityEvent(
  event: Pick<ActivityEvent, 'type' | 'metadata'>,
  resolve: StaffNameResolver,
): string {
  switch (event.type) {
    case ActivityEventType.STATUS_CHANGED:
      return describeStatusChange(event.metadata);
    case ActivityEventType.RESPONSIBLE_CHANGED:
      return describeResponsibleChange(event.metadata, resolve);
    default:
      return ACTIVITY_EVENT_CONFIG[event.type]?.label ?? 'alterou a atividade';
  }
}
