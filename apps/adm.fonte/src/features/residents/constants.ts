import { FamilyInvestment, FollowUpAccessLevel, FollowUpType, ResidentStatus } from '@fonte/types';
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

export const FAMILY_INVESTMENT_LABELS: Record<FamilyInvestment, string> = {
  [FamilyInvestment.BASKET_500]: 'R$ 500 + cestas',
  [FamilyInvestment.PAYMENT_700]: 'R$ 700',
  [FamilyInvestment.SOCIAL]: 'Social',
  [FamilyInvestment.NEGOTIATED]: 'Negociado',
};

export const FAMILY_INVESTMENT_VARIANT: Record<FamilyInvestment, BadgeVariant> = {
  [FamilyInvestment.BASKET_500]: 'info',
  [FamilyInvestment.PAYMENT_700]: 'success',
  [FamilyInvestment.SOCIAL]: 'secondary',
  [FamilyInvestment.NEGOTIATED]: 'warning',
};

/** Valor canônico para modalidades fixas; NEGOTIATED usa familyInvestmentAmount */
export const FAMILY_INVESTMENT_CANONICAL: Partial<Record<FamilyInvestment, number>> = {
  [FamilyInvestment.BASKET_500]: 500,
  [FamilyInvestment.PAYMENT_700]: 700,
  [FamilyInvestment.SOCIAL]: 0,
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

/** Parentescos mais prováveis; "Outro" libera campo livre. */
export const RELATIONSHIP_OPTIONS = [
  'Mãe',
  'Pai',
  'Madrasta',
  'Padrasto',
  'Avó',
  'Avô',
  'Irmã',
  'Irmão',
  'Esposa',
  'Esposo',
  'Companheira',
  'Companheiro',
  'Filha',
  'Filho',
  'Tia',
  'Tio',
  'Prima',
  'Primo',
  'Madrinha',
  'Padrinho',
  'Sogra',
  'Sogro',
  'Cunhada',
  'Cunhado',
  'Amiga',
  'Amigo',
  'Outro',
] as const;

export const FOLLOW_UP_ACCESS_LABELS: Record<FollowUpAccessLevel, string> = {
  [FollowUpAccessLevel.ALL]: 'Todos',
  [FollowUpAccessLevel.ADMINISTRATION]: 'Administração',
};
