import { FollowUpAccessLevel, FollowUpType, ResidentStatus } from '@fonte/types';
import type { BadgeProps } from '@/components/ui/badge';

export const RESIDENT_STATUS_LABELS: Record<ResidentStatus, string> = {
  [ResidentStatus.PRE_ADMISSION]: 'Pré-admissão',
  [ResidentStatus.ACTIVE]: 'Ativo',
  [ResidentStatus.DISCIPLINE]: 'Disciplina',
  [ResidentStatus.TEMP_LEAVE]: 'Saída temporária',
  [ResidentStatus.DISCHARGED]: 'Alta',
  [ResidentStatus.EVADED]: 'Evasão',
};

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const RESIDENT_STATUS_VARIANT: Record<ResidentStatus, BadgeVariant> = {
  [ResidentStatus.PRE_ADMISSION]: 'secondary',
  [ResidentStatus.ACTIVE]: 'success',
  [ResidentStatus.DISCIPLINE]: 'warning',
  [ResidentStatus.TEMP_LEAVE]: 'info',
  [ResidentStatus.DISCHARGED]: 'purple',
  [ResidentStatus.EVADED]: 'destructive',
};

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  [FollowUpType.ADMISSION]: 'Admissão',
  [FollowUpType.READMISSION]: 'Reintrodução',
  [FollowUpType.DISCHARGE]: 'Alta',
  [FollowUpType.EVASION]: 'Evasão',
  [FollowUpType.MINISTRY_CHANGE]: 'Mudança de ministério',
  [FollowUpType.RELATIVE_ADDED]: 'Familiar cadastrado',
  [FollowUpType.DOCUMENT_ATTACHED]: 'Documento anexado',
  [FollowUpType.MONTHLY_CONTRIBUTION]: 'Contribuição mensal',
  [FollowUpType.DISCIPLINE]: 'Disciplina',
  [FollowUpType.BEHAVIOR_ASSESSMENT]: 'Avaliação de conduta',
  [FollowUpType.NOTE]: 'Observação',
};

export const FOLLOW_UP_TYPE_ICONS: Record<FollowUpType, string> = {
  [FollowUpType.ADMISSION]: 'LogIn',
  [FollowUpType.READMISSION]: 'RefreshCw',
  [FollowUpType.DISCHARGE]: 'LogOut',
  [FollowUpType.EVASION]: 'AlertTriangle',
  [FollowUpType.MINISTRY_CHANGE]: 'Shuffle',
  [FollowUpType.RELATIVE_ADDED]: 'Users',
  [FollowUpType.DOCUMENT_ATTACHED]: 'Paperclip',
  [FollowUpType.MONTHLY_CONTRIBUTION]: 'DollarSign',
  [FollowUpType.DISCIPLINE]: 'ShieldAlert',
  [FollowUpType.BEHAVIOR_ASSESSMENT]: 'ClipboardList',
  [FollowUpType.NOTE]: 'StickyNote',
};

export const FOLLOW_UP_ACCESS_LABELS: Record<FollowUpAccessLevel, string> = {
  [FollowUpAccessLevel.ALL]: 'Todos',
  [FollowUpAccessLevel.ADMINISTRATION]: 'Administração',
};
