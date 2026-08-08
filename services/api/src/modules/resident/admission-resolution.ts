/**
 * Story 164 — regras de resolução de acolhimento, em funções puras (sem banco).
 *
 * Um filho pode ter vários `Admission`. Duas perguntas aparecem em lugares
 * diferentes do backend e precisam responder SEMPRE igual:
 *
 *  1. "qual é o acolhimento atual?" (`ResidentService.update`, `findAdmissions`);
 *  2. "a que acolhimento pertence a competência M do carnê?"
 *     (`ResidentReceivableService` e o backfill da migration).
 *
 * Manter as duas regras aqui evita que a escrita e a leitura divirjam. O SQL do
 * backfill em `AddAdmissionToReceivables` implementa exatamente a mesma ordem.
 */

/** Subconjunto de `Admission` que as regras precisam — facilita testar. */
export interface AdmissionWindow {
  id: string;
  entryDate: Date | string | null;
  exitDate: Date | string | null;
  createdAt?: Date | string | null;
}

/** Normaliza `date`/`timestamp` do TypeORM para `YYYY-MM-DD` comparável como string. */
function toDay(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return text.slice(0, 10);
}

/**
 * A entrada é comparada com a competência em granularidade de MÊS.
 *
 * Competência é sempre o dia 1; entrada quase nunca é. Comparar dia a dia jogaria
 * o primeiro mês do acolhimento (entrada 2026-07-17 vs competência 2026-07-01)
 * para o acolhimento ANTERIOR — exatamente o defeito que a story conserta.
 */
function toMonth(value: Date | string | null | undefined): string | null {
  return toDay(value)?.slice(0, 7) ?? null;
}

function createdAtTime(admission: AdmissionWindow): number {
  const raw = admission.createdAt;
  if (raw == null) return 0;
  const time = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Ordena do acolhimento mais recente para o mais antigo:
 * `entry_date DESC NULLS LAST`, desempate `created_at DESC` (decisão 6).
 * O índice 0 é o **acolhimento atual** — inclusive em ficha importada, onde as
 * admissões antigas foram gravadas DEPOIS da atual e `created_at` mente.
 */
export function sortAdmissionsByEntryDateDesc<T extends AdmissionWindow>(admissions: T[]): T[] {
  return [...admissions].sort((a, b) => {
    const entryA = toDay(a.entryDate);
    const entryB = toDay(b.entryDate);
    if (entryA !== entryB) {
      if (entryA == null) return 1; // NULLS LAST
      if (entryB == null) return -1;
      return entryA < entryB ? 1 : -1;
    }
    return createdAtTime(b) - createdAtTime(a);
  });
}

/** Ordena do mais antigo para o mais recente: `entry_date ASC NULLS LAST`, `created_at ASC`. */
export function sortAdmissionsByEntryDateAsc<T extends AdmissionWindow>(admissions: T[]): T[] {
  return [...admissions].sort((a, b) => {
    const entryA = toDay(a.entryDate);
    const entryB = toDay(b.entryDate);
    if (entryA !== entryB) {
      if (entryA == null) return 1; // NULLS LAST
      if (entryB == null) return -1;
      return entryA < entryB ? -1 : 1;
    }
    return createdAtTime(a) - createdAtTime(b);
  });
}

/** Id do acolhimento atual, ou `null` quando o filho não tem nenhum. */
export function resolveCurrentAdmissionId(admissions: AdmissionWindow[]): string | null {
  return sortAdmissionsByEntryDateDesc(admissions)[0]?.id ?? null;
}

/**
 * A janela do acolhimento cobre a competência?
 *
 * Saída ausente → janela aberta. Saída **anterior** à entrada é dado ruim da
 * planilha (existe em produção) e também é tratada como janela aberta (decisão
 * 9a): confiar nela jogaria as competências para o acolhimento errado.
 */
function windowCovers(admission: AdmissionWindow, month: string): boolean {
  const entry = toDay(admission.entryDate);
  const exit = toDay(admission.exitDate);
  if (exit == null) return true;
  if (entry != null && exit < entry) return true;
  return month <= exit;
}

/**
 * Acolhimento dono da competência `referenceMonth` (decisão 9):
 *  a. o de maior entrada iniciada até o mês de `M` e cuja janela ainda cobre `M`;
 *  b. senão, o de maior entrada iniciada até o mês de `M` (competência entre
 *     dois acolhimentos pertence ao que a antecede);
 *  c. senão (competência anterior à primeira entrada), o mais antigo;
 *  d. sem acolhimentos, `null`.
 *
 * `admissions` deve conter só as admissões vivas (`deleted_at IS NULL`) do filho.
 */
export function resolveAdmissionIdForMonth(
  admissions: AdmissionWindow[],
  referenceMonth: Date | string,
): string | null {
  if (admissions.length === 0) return null;
  const month = toDay(referenceMonth);
  if (month == null) return null;

  const competenceMonth = month.slice(0, 7);
  const started = admissions.filter((a) => {
    const entry = toMonth(a.entryDate);
    return entry != null && entry <= competenceMonth;
  });

  // (c) nenhuma entrada anterior à competência → o acolhimento mais antigo.
  if (started.length === 0) return sortAdmissionsByEntryDateAsc(admissions)[0].id;

  const covering = started.filter((a) => windowCovers(a, month));
  const pool = covering.length > 0 ? covering : started;

  // (a)/(b): maior entrada vence; empate → o registrado primeiro.
  return pool.reduce((best, candidate) => {
    const bestEntry = toDay(best.entryDate)!;
    const candidateEntry = toDay(candidate.entryDate)!;
    if (candidateEntry !== bestEntry) return candidateEntry > bestEntry ? candidate : best;
    return createdAtTime(candidate) < createdAtTime(best) ? candidate : best;
  }).id;
}
