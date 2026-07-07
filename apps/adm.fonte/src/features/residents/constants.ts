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

/**
 * Estado de um item da fila de import em lote. `imported` é o estado final após
 * o commit aprovado (story 105): o card permanece na lista para dar feedback do
 * que já entrou, mas sai da contagem de pendentes.
 */
export type ImportItemStatus = 'queued' | 'processing' | 'ready' | 'error' | 'imported';

export const IMPORT_ITEM_STATUS_LABELS: Record<ImportItemStatus, string> = {
  queued: 'Na fila',
  processing: 'Processando...',
  ready: 'Pronto',
  error: 'Erro',
  imported: 'Importado',
};

export const IMPORT_ITEM_STATUS_VARIANT: Record<ImportItemStatus, BadgeVariant> = {
  queued: 'secondary',
  processing: 'info',
  ready: 'success',
  error: 'destructive',
  imported: 'success',
};

/** Textos da tela de import em lote. */
export const IMPORT_TEXTS = {
  emptyQueue: 'Arraste as fichas .docx para começar',
  fichaDisabled: 'Carregue a planilha de referência antes de adicionar as fichas.',
  onlyDocx: 'Apenas arquivos .docx são aceitos.',
  onlyXlsx: 'Apenas planilhas .xlsx são aceitas.',
  conflictBadge: 'Conflito',
  okSummary: 'Sem alertas',
  // Aprovação / commit (story 105).
  approve: 'Aprovar',
  viewFicha: 'Ver ficha',
  modalTitle: 'Ficha do filho',
  modalDescription: 'Revise e edite os dados antes de aprovar a importação.',
  approving: 'Aprovando...',
  imported: 'Filho importado com sucesso.',
  conflictReason: 'Resolva o conflito antes de aprovar.',
  sessionConflictReason: 'Já importado nesta sessão.',
  noRelativesReason: 'Cadastre ao menos um familiar para aprovar.',
  commitError: 'Não foi possível aprovar a importação.',
  relativesTitle: 'Familiares',
  addRelative: 'Adicionar familiar',
  // Histórico de contribuição (story 108) — read-only, vindo da planilha.
  contributionHistoryTitle: 'Histórico de contribuição',
  contributionHistoryEmpty: 'Nenhuma contribuição registrada na planilha.',
} as const;

/** Prefixo do alerta de conflito com um filho já importado nesta sessão. */
export function sessionConflictMessage(name: string): string {
  return `Já importado nesta sessão: ${name}.`;
}

/** Alerta de conflito com filho(s) já cadastrado(s) (nome/CPF). */
export function existingConflictMessage(names: string[]): string {
  return names.length === 1
    ? `Já existe um filho cadastrado que confere: ${names[0]}.`
    : `Já existem filhos cadastrados que conferem: ${names.join(', ')}.`;
}

/** Rótulo de resumo a partir da contagem de alertas (warnings). */
export function importWarningsSummary(count: number): string {
  if (count <= 0) return IMPORT_TEXTS.okSummary;
  return count === 1 ? '1 alerta' : `${count} alertas`;
}

/**
 * Rótulos legíveis para as chaves de `preview.warnings` (Record<campo, mensagem>)
 * emitidas pelo parse/cross-match do import (stories 101/102). Chaves sem rótulo
 * caem no fallback humanizado de `importWarningFieldLabel`.
 */
export const IMPORT_WARNING_FIELD_LABELS: Record<string, string> = {
  spreadsheet: 'Planilha',
  entryDate: 'Data de entrada',
  exitDate: 'Data de saída',
  familyContact: 'Contato do familiar',
  weight: 'Peso',
  height: 'Altura',
  name: 'Nome',
  cpf: 'CPF',
  rg: 'RG',
  birthDate: 'Data de nascimento',
  phone: 'Telefone',
  gender: 'Sexo',
  maritalStatus: 'Estado civil',
  house: 'Casa',
};

/** Rótulo legível para uma chave de warning; humaniza a chave se não houver mapeamento. */
export function importWarningFieldLabel(key: string): string {
  const mapped = IMPORT_WARNING_FIELD_LABELS[key];
  if (mapped) return mapped;
  // Humaniza camelCase/underscore como fallback ("familyContact" → "Family contact").
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Item de warning normalizado para exibição (campo → mensagem). */
export interface ImportWarningItem {
  key: string;
  label: string;
  message: string;
}

/**
 * Normaliza `preview.warnings` (Record<campo, mensagem>) em lista ordenada,
 * descartando mensagens vazias e adicionando o rótulo legível do campo.
 */
export function warningsToList(warnings: Record<string, string>): ImportWarningItem[] {
  return Object.entries(warnings)
    .filter(([, message]) => Boolean(message))
    .map(([key, message]) => ({ key, label: importWarningFieldLabel(key), message }));
}

/** Textos dos alertas de import (popover no card + seção no modal). */
export const IMPORT_WARNINGS_TEXTS = {
  reviewHeader: 'Atenção — campos que precisam de revisão manual',
} as const;
