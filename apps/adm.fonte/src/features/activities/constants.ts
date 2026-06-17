import { ActivityStatus } from '@fonte/types';

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
