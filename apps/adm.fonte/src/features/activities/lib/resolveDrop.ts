import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import {
  canTransition,
  isTransitionAllowed,
  requiresApprovalDialog,
  type TransitionUser,
} from './transitions';

/** Resultado da resolução de um drop no board. */
export type DropResolution =
  | { kind: 'noop' }
  | { kind: 'invalid'; activity: Activity; to: ActivityStatus }
  | { kind: 'approve'; activity: Activity; to: ActivityStatus }
  | { kind: 'move'; activity: Activity; to: ActivityStatus };

/**
 * Decide o que fazer quando um card é solto numa coluna. Pura — sem efeitos —
 * para ser testável. A page traduz cada `kind` em ação:
 *
 * - `noop`    → soltou na mesma coluna (ou fora): nada a fazer.
 * - `invalid` → transição/permissão negada pelo client: não chama a API,
 *               mostra erro (o card já está visualmente de volta — não houve move).
 * - `approve` → REQUESTED → TODO: abre o `ApproveActivityDialog` (escolher responsável).
 * - `move`    → dispara `PATCH /activities/:id/status` (otimista + rollback no erro).
 */
export function resolveDrop(
  activity: Activity | undefined,
  to: ActivityStatus | undefined,
  user: TransitionUser,
): DropResolution {
  if (!activity || !to) return { kind: 'noop' };
  if (activity.status === to) return { kind: 'noop' };

  // Transição inexistente na matriz, ou existente mas sem permissão do usuário.
  if (!isTransitionAllowed(activity.status, to)) {
    return { kind: 'invalid', activity, to };
  }
  if (!canTransition(activity, to, user)) {
    return { kind: 'invalid', activity, to };
  }

  if (requiresApprovalDialog(activity.status, to)) {
    return { kind: 'approve', activity, to };
  }

  return { kind: 'move', activity, to };
}
