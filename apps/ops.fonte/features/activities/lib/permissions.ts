import { ActivityStatus, Role } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

/** Status em que o criador ainda pode editar a descrição (espelha o backend, story 62). */
const CREATOR_EDITABLE_STATUSES: ActivityStatus[] = [
  ActivityStatus.DRAFT,
  ActivityStatus.REQUESTED,
  ActivityStatus.TODO,
];

/**
 * Espelha `canEditDescription` do backend (autoridade):
 * - ADMIN edita a descrição em qualquer status.
 * - Criador edita em DRAFT/REQUESTED/TODO; bloqueado a partir de DOING.
 * - Ninguém mais edita.
 */
export function canEditDescription(
  activity: Pick<Activity, 'status' | 'createdByUserId'>,
  user: { role: string | null | undefined; userId: string | null | undefined },
): boolean {
  if (user.role === Role.ADMIN) return true;
  if (!user.userId || activity.createdByUserId !== user.userId) return false;
  return CREATOR_EDITABLE_STATUSES.includes(activity.status);
}
