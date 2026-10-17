import {
  AUDIT_ACTION_LABELS,
  AUDIT_FIELD_LABELS,
  AUDIT_FILE_MARKER,
  AUDIT_TARGET_TYPE_LABELS,
  AuditAction,
  LOGIN_FAILURE_REASON_LABELS,
  type LoginFailureReason,
} from '@fonte/types';

/** Story 199 — rótulos da tela de auditoria (catálogo vem de @fonte/types). */

export const OUTCOME_LABELS: Record<string, string> = {
  SUCCESS: 'Sucesso',
  FAILURE: 'Falha',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  COORDINATOR: 'Coordenador',
  SERVANT: 'Servo',
  RELATIVE: 'Familiar',
  RESIDENT: 'Filho',
};

/** Ações oferecidas no filtro, na ordem do catálogo. */
export const ACTION_OPTIONS = Object.values(AuditAction).map((value) => ({
  value,
  label: AUDIT_ACTION_LABELS[value] ?? value,
}));

export const EMPTY_VALUE_LABEL = '(vazio)';
export const PROTECTED_VALUE_LABEL = 'Dado protegido';
export const FILE_VALUE_LABEL = 'Arquivo';
export const LEGACY_DETAIL_MESSAGE =
  'Detalhe indisponível: evento registrado antes do histórico de alterações.';
export const NO_DIFF_MESSAGE = 'Esta ação não altera campos — veja o contexto abaixo.';

export function actionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function targetTypeLabel(type: string | null): string {
  if (!type) return '—';
  return AUDIT_TARGET_TYPE_LABELS[type] ?? type;
}

export function fieldLabel(field: string): string {
  return AUDIT_FIELD_LABELS[field] ?? field;
}

export function reasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  return LOGIN_FAILURE_REASON_LABELS[reason as LoginFailureReason] ?? reason;
}

/**
 * Valor de uma célula Antes/Depois. Nunca JSON bruto: vazio, protegido e
 * arquivo têm marcador próprio; booleanos viram Sim/Não.
 */
export function formatChangeValue(value: unknown, redacted: boolean): string {
  if (value === null || value === undefined || value === '') {
    return redacted ? PROTECTED_VALUE_LABEL : EMPTY_VALUE_LABEL;
  }
  if (value === AUDIT_FILE_MARKER) return FILE_VALUE_LABEL;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.map((v) => formatChangeValue(v, false)).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${fieldLabel(k)}: ${formatChangeValue(v, false)}`)
      .join('; ');
  }
  return String(value);
}

/** Rótulos dos metadados de contexto (login, documentos, contagem). */
export const CONTEXT_LABELS: Record<string, string> = {
  identifier: 'Identificador (mascarado)',
  status: 'Status HTTP',
  templateIds: 'Templates',
  format: 'Formato',
  count: 'Quantidade',
  staffId: 'Servo criado',
  confirmedCount: 'Confirmados',
  total: 'Total',
  addedCount: 'Adicionados',
};

export function contextLabel(key: string): string {
  return CONTEXT_LABELS[key] ?? key;
}
