import { ActivityEventType, ActivityStatus } from '@fonte/types';

/**
 * Colunas do quadro de atividades (story 208): uma aba por status, na ordem do
 * board do `adm` e do backend. Fonte única de ordem e rótulo das abas.
 */
export const ACTIVITY_COLUMNS: readonly { status: ActivityStatus; title: string }[] = [
  { status: ActivityStatus.DRAFT, title: 'Rascunhos' },
  { status: ActivityStatus.REQUESTED, title: 'Solicitações' },
  { status: ActivityStatus.TODO, title: 'A fazer' },
  { status: ActivityStatus.DOING, title: 'Fazendo' },
  { status: ActivityStatus.BLOCKED, title: 'Impedimento' },
  { status: ActivityStatus.DONE, title: 'Concluídas' },
];

/**
 * Espelha a matriz de criação do backend (story 48). No ops, o staff (não-ADMIN)
 * só cria em rascunho (`DRAFT`). Quick-add só pede o título, então só aparece em
 * colunas que NÃO exigem campo adicional — ou seja, apenas `DRAFT`.
 *
 * O `role` é recebido para manter a regra alinhada à matriz e fácil de ajustar
 * caso a permissão por status passe a depender do papel.
 */
export function canQuickAddInStatus(
  status: ActivityStatus,
  _role: string | null | undefined,
): boolean {
  return status === ActivityStatus.DRAFT;
}

// ── Histórico (story 220 — espelho de adm/features/activities/constants.ts) ──

/** Rótulo de cada status no histórico, o mesmo das abas. */
export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = Object.fromEntries(
  ACTIVITY_COLUMNS.map((c) => [c.status, c.title]),
) as Record<ActivityStatus, string>;

/** Ícone (Ionicons) + verbo de cada tipo de evento, sem o ator. */
export const ACTIVITY_EVENT_CONFIG: Record<ActivityEventType, { icon: string; label: string }> = {
  [ActivityEventType.CREATED]: { icon: 'add-circle-outline', label: 'criou a atividade' },
  [ActivityEventType.STATUS_CHANGED]: { icon: 'swap-horizontal-outline', label: 'moveu' },
  [ActivityEventType.TITLE_CHANGED]: { icon: 'create-outline', label: 'alterou o título' },
  [ActivityEventType.DESCRIPTION_CHANGED]: {
    icon: 'document-text-outline',
    label: 'alterou a descrição',
  },
  [ActivityEventType.RESPONSIBLE_CHANGED]: {
    icon: 'person-outline',
    label: 'alterou o responsável',
  },
  [ActivityEventType.COMMENTED]: { icon: 'chatbubble-outline', label: 'comentou' },
  [ActivityEventType.DELETED]: { icon: 'trash-outline', label: 'excluiu a atividade' },
};

/** Nome do servo quando o id não está mais na lista da casa. */
export const REMOVED_STAFF_LABEL = 'servo removido';
