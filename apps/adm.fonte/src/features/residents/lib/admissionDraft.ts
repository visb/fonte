/**
 * Rascunho local do acolhimento (story 211).
 *
 * O wizard de acolhimento e a reintrodução gravam seus campos no `localStorage`
 * conforme o preenchimento avança, para sobreviver a queda de energia, F5 ou aba
 * fechada. Contém dado pessoal e de saúde num computador possivelmente
 * compartilhado (decisão 8), por isso:
 *  - a chave carrega o `userId` logado — outro usuário no mesmo navegador não lê;
 *  - expira em 7 dias (descartado na leitura);
 *  - é apagado no logout, ao concluir, ao descartar e ao cancelar;
 *  - nunca guarda arquivo (foto/comprovante) — só flags de que existiam.
 *
 * Toda leitura/escrita fica em try/catch (decisão 10): storage cheio, bloqueado
 * ou JSON corrompido nunca quebra o wizard — só não há rascunho.
 */

export const ADMISSION_DRAFT_VERSION = 1;
export const ADMISSION_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMISSION_DRAFT_PREFIX = 'fonte:admission-draft:';

export interface AdmissionDraft<V = Record<string, unknown>> {
  version: number;
  /** ISO 8601 do último salvamento. */
  savedAt: string;
  values: V;
  step: number;
  residentId: string | null;
  firstPaymentPaid: boolean;
  firstPaymentMethod: string;
  /** Havia foto escolhida (o arquivo em si não entra no rascunho). */
  hadPhoto: boolean;
  /** Havia comprovante do 1º pagamento escolhido (idem). */
  hadProof: boolean;
}

export type AdmissionDraftData<V = Record<string, unknown>> = Omit<
  AdmissionDraft<V>,
  'version' | 'savedAt'
>;

/**
 * Chave do rascunho. Sem `residentId`: primeiro acolhimento (1 por usuário).
 * Com `residentId`: reintrodução daquele filho (1 por filho por usuário).
 */
export function admissionDraftKey(userId: string, readmissionResidentId?: string): string {
  const base = `${ADMISSION_DRAFT_PREFIX}${userId}`;
  return readmissionResidentId ? `${base}:readmission:${readmissionResidentId}` : base;
}

export function clearAdmissionDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage indisponível: não há o que apagar.
  }
}

function isDraft(value: unknown): value is AdmissionDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<AdmissionDraft>;
  return (
    d.version === ADMISSION_DRAFT_VERSION &&
    typeof d.savedAt === 'string' &&
    !!d.values &&
    typeof d.values === 'object'
  );
}

/** Lê o rascunho; vencido, de outra versão ou corrompido → apaga e devolve null. */
export function readAdmissionDraft<V = Record<string, unknown>>(
  key: string,
  now: number = Date.now(),
): AdmissionDraft<V> | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const savedAtMs = isDraft(parsed) ? Date.parse(parsed.savedAt) : NaN;
    if (!isDraft(parsed) || Number.isNaN(savedAtMs) || now - savedAtMs > ADMISSION_DRAFT_TTL_MS) {
      clearAdmissionDraft(key);
      return null;
    }
    return {
      ...parsed,
      step: typeof parsed.step === 'number' ? parsed.step : 0,
      residentId: parsed.residentId ?? null,
      firstPaymentPaid: !!parsed.firstPaymentPaid,
      firstPaymentMethod: parsed.firstPaymentMethod ?? '',
      hadPhoto: !!parsed.hadPhoto,
      hadProof: !!parsed.hadProof,
    } as AdmissionDraft<V>;
  } catch {
    clearAdmissionDraft(key);
    return null;
  }
}

/** Grava o rascunho. Devolve o `savedAt` gravado, ou null se o storage falhou. */
export function writeAdmissionDraft<V>(
  key: string,
  data: AdmissionDraftData<V>,
  now: Date = new Date(),
): string | null {
  const savedAt = now.toISOString();
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...data, version: ADMISSION_DRAFT_VERSION, savedAt }),
    );
    return savedAt;
  } catch {
    return null;
  }
}

/** Apaga todos os rascunhos do usuário (primeiro acolhimento + reintroduções). */
export function clearUserAdmissionDrafts(userId: string | null | undefined): void {
  if (!userId) return;
  const base = admissionDraftKey(userId);
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k === base || k.startsWith(`${base}:`))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage indisponível: nada foi gravado.
  }
}

const SAO_PAULO = 'America/Sao_Paulo';

/** "17/10/2026 14:05" — data/hora do rascunho no fuso da operação. */
export function formatDraftDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO });
  return `${date} ${formatDraftTime(iso)}`;
}

/** "14:05" — hora do rascunho no fuso da operação. */
export function formatDraftTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: SAO_PAULO,
    hour: '2-digit',
    minute: '2-digit',
  });
}
