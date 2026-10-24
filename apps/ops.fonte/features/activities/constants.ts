import { ActivityEventType, ActivityStatus } from '@fonte/types';
import { canCreateInStatus, type ActivityViewer } from './lib/permissions';

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
 * Quick-add por coluna (story 224): `DRAFT` para todos; `REQUESTED` e `TODO` só
 * para o coordenador da casa (em `TODO` o card pede o responsável num modal).
 * Fazendo/Impedimento/Concluídas nunca. Espelha a matriz de criação do backend.
 */
export function canQuickAddInStatus(status: ActivityStatus, viewer: ActivityViewer): boolean {
  return canCreateInStatus(status, viewer);
}

/** Rótulo de cada status no seletor do formulário de criação (story 224). */
export const CREATE_STATUS_LABELS: Partial<Record<ActivityStatus, string>> = {
  [ActivityStatus.DRAFT]: 'Rascunho',
  [ActivityStatus.REQUESTED]: 'Solicitação',
  [ActivityStatus.TODO]: 'A fazer',
};

/** Texto do botão e dos avisos de criação, por status (story 224, decisão 9). */
export const CREATE_COPY: Partial<
  Record<ActivityStatus, { button: string; sent: string; queued: string }>
> = {
  [ActivityStatus.DRAFT]: {
    button: 'Criar rascunho',
    sent: 'Rascunho criado.',
    queued: 'Sem conexão agora: o rascunho será enviado assim que a conexão voltar.',
  },
  [ActivityStatus.REQUESTED]: {
    button: 'Criar solicitação',
    sent: 'Solicitação criada.',
    queued: 'Sem conexão agora: a solicitação será enviada assim que a conexão voltar.',
  },
  [ActivityStatus.TODO]: {
    button: 'Criar atividade',
    sent: 'Atividade criada.',
    queued: 'Sem conexão agora: a atividade será enviada assim que a conexão voltar.',
  },
};

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
