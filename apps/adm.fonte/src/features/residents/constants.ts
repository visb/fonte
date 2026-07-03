import { FamilyInvestment, FollowUpAccessLevel, FollowUpType, Gender, MaritalStatus, PaymentMethod, ResidentStatus } from '@fonte/types';
import type { BadgeProps } from '@/components/ui/badge';

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
};

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  [MaritalStatus.SINGLE]: 'Solteiro(a)',
  [MaritalStatus.MARRIED]: 'Casado(a)',
  [MaritalStatus.DIVORCED]: 'Divorciado(a)',
};

export const RESIDENT_STATUS_LABELS: Record<ResidentStatus, string> = {
  [ResidentStatus.PRE_ADMISSION]: 'Pré-admissão',
  [ResidentStatus.ACTIVE]: 'Ativo',
  [ResidentStatus.DISCIPLINE]: 'Disciplina',
  [ResidentStatus.TEMP_LEAVE]: 'Saída temporária',
  [ResidentStatus.DISCHARGED]: 'Alta',
  [ResidentStatus.EVADED]: 'Evasão',
  [ResidentStatus.CENSUS_ADDED]: 'Adicionado na contagem',
  [ResidentStatus.REJECTED_CENSUS]: 'Recusado na contagem',
};

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const RESIDENT_STATUS_VARIANT: Record<ResidentStatus, BadgeVariant> = {
  [ResidentStatus.PRE_ADMISSION]: 'secondary',
  [ResidentStatus.ACTIVE]: 'success',
  [ResidentStatus.DISCIPLINE]: 'warning',
  [ResidentStatus.TEMP_LEAVE]: 'info',
  [ResidentStatus.DISCHARGED]: 'purple',
  [ResidentStatus.EVADED]: 'destructive',
  [ResidentStatus.CENSUS_ADDED]: 'warning',
  [ResidentStatus.REJECTED_CENSUS]: 'secondary',
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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Dinheiro',
  [PaymentMethod.PIX]: 'PIX',
  [PaymentMethod.CREDIT_CARD]: 'Cartão de Crédito',
  [PaymentMethod.DEBIT_CARD]: 'Cartão de Débito',
  [PaymentMethod.BASKET]: 'Cesta',
  [PaymentMethod.OTHER]: 'Outro',
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
  [FollowUpType.PROMOTED_TO_SERVANT]: 'Tornou-se servo',
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
  [FollowUpType.PROMOTED_TO_SERVANT]: 'UserPlus',
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

// ─── Import em lote (story 104) ─────────────────────────────────────────────

/**
 * Número máximo de fichas `.docx` extraídas ao mesmo tempo. Constante única e
 * fácil de ajustar — a fila nunca coloca mais que N itens em `processing`.
 */
export const IMPORT_BATCH_SIZE = 5;

/** Estado de um item da fila de import em lote. */
export type ImportItemStatus = 'queued' | 'processing' | 'ready' | 'error';

export const IMPORT_ITEM_STATUS_LABELS: Record<ImportItemStatus, string> = {
  queued: 'Na fila',
  processing: 'Processando...',
  ready: 'Pronto',
  error: 'Erro',
};

export const IMPORT_ITEM_STATUS_VARIANT: Record<ImportItemStatus, BadgeVariant> = {
  queued: 'secondary',
  processing: 'info',
  ready: 'success',
  error: 'destructive',
};

/** Textos da tela de import em lote. */
export const IMPORT_TEXTS = {
  emptyQueue: 'Arraste as fichas .docx para começar',
  fichaDisabled: 'Carregue a planilha de referência antes de adicionar as fichas.',
  onlyDocx: 'Apenas arquivos .docx são aceitos.',
  onlyXlsx: 'Apenas planilhas .xlsx são aceitas.',
  conflictBadge: 'Conflito',
  okSummary: 'Sem alertas',
} as const;

/** Rótulo de resumo a partir da contagem de alertas (warnings). */
export function importWarningsSummary(count: number): string {
  if (count <= 0) return IMPORT_TEXTS.okSummary;
  return count === 1 ? '1 alerta' : `${count} alertas`;
}
