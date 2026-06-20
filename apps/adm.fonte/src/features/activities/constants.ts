import {
  ArrowRightLeft,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { ActivityEventType, ActivityStatus } from '@fonte/types';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'purple';

export interface ActivityColumnDef {
  status: ActivityStatus;
  label: string;
  variant: BadgeVariant;
}

/** Colunas do board, da esquerda para a direita (ordem fixa = enum). */
export const ACTIVITY_COLUMNS: ActivityColumnDef[] = [
  { status: ActivityStatus.DRAFT, label: 'Rascunho', variant: 'outline' },
  { status: ActivityStatus.REQUESTED, label: 'Solicitações', variant: 'info' },
  { status: ActivityStatus.TODO, label: 'A fazer', variant: 'secondary' },
  { status: ActivityStatus.DOING, label: 'Fazendo', variant: 'warning' },
  { status: ActivityStatus.BLOCKED, label: 'Impedimento', variant: 'destructive' },
  { status: ActivityStatus.DONE, label: 'Concluídas', variant: 'success' },
];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> =
  ACTIVITY_COLUMNS.reduce(
    (acc, c) => ({ ...acc, [c.status]: c.label }),
    {} as Record<ActivityStatus, string>,
  );

export const ACTIVITY_STATUS_VARIANTS: Record<ActivityStatus, BadgeVariant> =
  ACTIVITY_COLUMNS.reduce(
    (acc, c) => ({ ...acc, [c.status]: c.variant }),
    {} as Record<ActivityStatus, BadgeVariant>,
  );

/**
 * Espelha a matriz de criação do backend (story 48). Quick-add só pede o título,
 * então só aparece em colunas que NÃO exigem campo adicional:
 *
 * - `DRAFT`: qualquer usuário pode criar (ADMIN, COORDINATOR, SERVANT).
 * - `TODO`: só ADMIN pode criar, mas exige responsável → fica fora do quick-add
 *   (continua via dialog/aprovação).
 * - demais colunas: não são pontos de criação direta.
 *
 * O `role` é recebido para manter a regra alinhada à matriz e fácil de ajustar
 * caso a permissão por status passe a depender do papel.
 */
export function canQuickAddInStatus(
  status: ActivityStatus,
  _role: string | null,
): boolean {
  return status === ActivityStatus.DRAFT;
}

// ── Histórico de eventos (story 66) ─────────────────────────────────────────────

export interface ActivityEventConfig {
  icon: LucideIcon;
  /** Verbo/descrição humana do evento (sem o ator, que é renderizado à parte). */
  label: string;
}

/** Mapa tipo de evento → ícone + label humano exibido na timeline do histórico. */
export const ACTIVITY_EVENT_CONFIG: Record<ActivityEventType, ActivityEventConfig> = {
  [ActivityEventType.CREATED]: { icon: Plus, label: 'criou a atividade' },
  [ActivityEventType.STATUS_CHANGED]: { icon: ArrowRightLeft, label: 'moveu' },
  [ActivityEventType.TITLE_CHANGED]: { icon: Pencil, label: 'alterou o título' },
  [ActivityEventType.DESCRIPTION_CHANGED]: {
    icon: FileText,
    label: 'alterou a descrição',
  },
  [ActivityEventType.RESPONSIBLE_CHANGED]: {
    icon: UserCog,
    label: 'alterou o responsável',
  },
  [ActivityEventType.COMMENTED]: { icon: MessageSquare, label: 'comentou' },
  [ActivityEventType.DELETED]: { icon: Trash2, label: 'excluiu a atividade' },
};

/**
 * Texto humano completo de um evento de status, usando os rótulos das colunas
 * (ex.: "moveu de A fazer para Fazendo"). Cai para o label genérico se faltar
 * metadado.
 */
export function describeStatusChange(metadata: unknown): string {
  const meta = metadata as { from?: ActivityStatus; to?: ActivityStatus } | null;
  if (!meta?.from || !meta?.to) return ACTIVITY_EVENT_CONFIG.STATUS_CHANGED.label;
  const from = ACTIVITY_STATUS_LABELS[meta.from] ?? meta.from;
  const to = ACTIVITY_STATUS_LABELS[meta.to] ?? meta.to;
  return `moveu de ${from} para ${to}`;
}
