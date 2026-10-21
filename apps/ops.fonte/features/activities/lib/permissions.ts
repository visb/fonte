import { ActivityStatus, Role } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { isHouseCoordinatorRole } from '@/lib/houseCoordinator';

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

/** Quem olha a atividade, para as regras do coordenador da casa (story 220). */
export interface ActivityViewer {
  role: string | null | undefined;
  houseId: string | null | undefined;
}

/**
 * Espelha `canManageResponsible` + a trava de DONE do backend (story 220): o
 * coordenador da casa (COORDINATOR ou ADMIN lotado na casa da atividade) atribui
 * ou troca o responsável em qualquer situação menos Concluída. SERVANT nunca. O
 * backend é a autoridade; aqui só esconde a ação.
 */
export function canManageResponsible(
  activity: Pick<Activity, 'status' | 'houseId'>,
  viewer: ActivityViewer,
): boolean {
  return (
    isHouseCoordinatorRole(viewer.role) &&
    !!viewer.houseId &&
    viewer.houseId === activity.houseId &&
    activity.status !== ActivityStatus.DONE
  );
}

/** Aprovar solicitação (REQUESTED → TODO): mesma regra, só em REQUESTED (story 220). */
export function canApproveRequest(
  activity: Pick<Activity, 'status' | 'houseId'>,
  viewer: ActivityViewer,
): boolean {
  return (
    activity.status === ActivityStatus.REQUESTED && canManageResponsible(activity, viewer)
  );
}

/**
 * Espelha `assertCanDelete` do backend (story 65): o autor do comentário ou um
 * ADMIN pode excluí-lo.
 */
export function canDeleteComment(
  comment: { createdByUserId: string },
  user: { role: string | null | undefined; userId: string | null | undefined },
): boolean {
  if (user.role === Role.ADMIN) return true;
  return !!user.userId && comment.createdByUserId === user.userId;
}
