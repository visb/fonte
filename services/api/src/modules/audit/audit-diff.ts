import { AUDIT_FILE_MARKER, AuditChange } from '@fonte/types';

/**
 * Projeção de antes/depois da auditoria (story 199).
 *
 * Cada domínio declara uma LISTA EXPLÍCITA de campos e como cada um é gravado.
 * Campo fora da lista nunca entra no log — é o que garante que hash de senha,
 * token e afins não vazem por acidente quando a entidade ganha coluna nova.
 *
 * - `plain`: valor normalizado como está.
 * - `masked`: valor mascarado ANTES de persistir (CPF/RG/telefone/e-mail);
 *   `redacted: true` sinaliza a alteração mesmo se as máscaras coincidirem.
 * - `redacted`: dado sensível (saúde, religião, texto livre) — só registra QUE
 *   mudou; antes/depois gravados como `null`.
 * - `file`: arquivo/URL — grava só o marcador `[arquivo]` (nunca a URL).
 */
export type AuditFieldKind = 'plain' | 'masked' | 'redacted' | 'file';
export type AuditFieldMap = Readonly<Record<string, AuditFieldKind>>;
export type AuditSnapshot = Record<string, unknown>;

/** Normaliza para comparação estável (datas, undefined, números em string). */
export function normalizeAuditValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (typeof value === 'string') {
    const trimmed = value;
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'object') return JSON.parse(JSON.stringify(value));
  return value;
}

/**
 * Máscara genérica de identificador: e-mail mantém 1ª letra e domínio; demais
 * valores mantêm só os 2 últimos caracteres alfanuméricos.
 */
export function maskAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.includes('@')) {
    const [local, domain] = text.split('@');
    return `${local.slice(0, 1)}***@${domain ?? ''}`;
  }
  const alnum = text.replace(/[^0-9a-zA-Z]/g, '');
  if (alnum.length <= 2) return '***';
  return `***${alnum.slice(-2)}`;
}

/**
 * Identificador de login mascarado: e-mail como acima; telefone só com os 4
 * últimos dígitos. Nunca grava o valor digitado por inteiro.
 */
export function maskLoginIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  if (text.includes('@')) return maskAuditValue(text);
  const digits = text.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

function project(kind: AuditFieldKind, value: unknown): unknown {
  if (value === null) return null;
  switch (kind) {
    case 'masked':
      return maskAuditValue(value);
    case 'redacted':
      return null;
    case 'file':
      return AUDIT_FILE_MARKER;
    default:
      return value;
  }
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Diferenças entre o estado persistido antes e depois.
 *
 * - criação (`before = null`): campos com valor no estado novo;
 * - exclusão (`after = null`): campos que tinham valor;
 * - edição: SOMENTE os campos que mudaram. Edição sem mudança → `[]` (no-op).
 */
export function diffSnapshots(
  fields: AuditFieldMap,
  before: AuditSnapshot | null,
  after: AuditSnapshot | null,
): AuditChange[] {
  if (!before && !after) return [];
  const changes: AuditChange[] = [];
  for (const [field, kind] of Object.entries(fields)) {
    const rawBefore = before ? normalizeAuditValue(before[field]) : null;
    const rawAfter = after ? normalizeAuditValue(after[field]) : null;
    if (same(rawBefore, rawAfter)) continue;
    changes.push({
      field,
      before: project(kind, rawBefore),
      after: project(kind, rawAfter),
      redacted: kind === 'masked' || kind === 'redacted',
    });
  }
  return changes;
}
