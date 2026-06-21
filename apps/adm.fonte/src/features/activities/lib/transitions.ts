import { ActivityStatus, Role } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

/**
 * Espelha a matriz de transições do backend (`activity.service.ts`, autoridade).
 * Só serve à UX do drag-and-drop: habilitar as colunas de destino válidas durante
 * o arraste. O backend continua decidindo de fato — um drop que o client liberou
 * por engano ainda é rejeitado lá e o card volta (rollback otimista).
 *
 *   DRAFT      → REQUESTED
 *   REQUESTED  → TODO | DRAFT
 *   TODO       → DOING
 *   DOING      → TODO | BLOCKED | DONE
 *   BLOCKED    → DOING | DONE
 *   DONE       → DOING
 */
export const ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  [ActivityStatus.DRAFT]: [ActivityStatus.REQUESTED],
  [ActivityStatus.REQUESTED]: [ActivityStatus.TODO, ActivityStatus.DRAFT],
  [ActivityStatus.TODO]: [ActivityStatus.DOING],
  [ActivityStatus.DOING]: [
    ActivityStatus.TODO,
    ActivityStatus.BLOCKED,
    ActivityStatus.DONE,
  ],
  [ActivityStatus.BLOCKED]: [ActivityStatus.DOING, ActivityStatus.DONE],
  [ActivityStatus.DONE]: [ActivityStatus.DOING],
};

/** Estágios do bloco de trabalho — mexidos por ADMIN ou pelo responsável. */
const WORK_STATUSES: ActivityStatus[] = [
  ActivityStatus.TODO,
  ActivityStatus.DOING,
  ActivityStatus.BLOCKED,
  ActivityStatus.DONE,
];

export interface TransitionUser {
  role: string | null;
  userId: string | null;
}

/** A transição existe na matriz (independente de quem)? */
export function isTransitionAllowed(
  from: ActivityStatus,
  to: ActivityStatus,
): boolean {
  if (from === to) return false;
  return ACTIVITY_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Espelha `assertCanChangeStatus` do backend: matriz + permissão por transição.
 * Retorna `true` quando o usuário corrente pode mover `activity` de seu status
 * atual para `to` (usado para destacar colunas-alvo durante o arraste).
 *
 * - DRAFT → REQUESTED: criador ou ADMIN.
 * - REQUESTED → TODO: só ADMIN (exige responsável; na UI abre o dialog de aprovação).
 * - REQUESTED → DRAFT: criador ou ADMIN (devolver / desfazer envio).
 * - bloco de trabalho (TODO/DOING/BLOCKED/DONE entre si): ADMIN ou o responsável.
 */
export function canTransition(
  activity: Pick<Activity, 'status' | 'createdByUserId' | 'responsible'>,
  to: ActivityStatus,
  user: TransitionUser,
): boolean {
  const from = activity.status;
  if (!isTransitionAllowed(from, to)) return false;

  const isAdmin = user.role === Role.ADMIN;

  if (from === ActivityStatus.DRAFT && to === ActivityStatus.REQUESTED) {
    return isAdmin || (!!user.userId && activity.createdByUserId === user.userId);
  }

  if (from === ActivityStatus.REQUESTED && to === ActivityStatus.TODO) {
    return isAdmin;
  }

  if (from === ActivityStatus.REQUESTED && to === ActivityStatus.DRAFT) {
    return isAdmin || (!!user.userId && activity.createdByUserId === user.userId);
  }

  if (WORK_STATUSES.includes(from) && WORK_STATUSES.includes(to)) {
    if (isAdmin) return true;
    return (
      !!user.userId &&
      activity.responsible?.userId != null &&
      activity.responsible.userId === user.userId
    );
  }

  return false;
}

/**
 * Soltar nesta coluna precisa do dialog de aprovação (escolher responsável)?
 * Só a transição REQUESTED → TODO.
 */
export function requiresApprovalDialog(
  from: ActivityStatus,
  to: ActivityStatus,
): boolean {
  return from === ActivityStatus.REQUESTED && to === ActivityStatus.TODO;
}
