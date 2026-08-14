/**
 * Consentimento no store local (story 175).
 *
 * O snapshot da casa (story 177) manda **registros** (`consent_records` é
 * append-only: revogar é linha nova com `granted: false`), mas a tela consome o
 * estado consolidado por finalidade (`api.consents.status`). O store guarda a
 * forma da tela — assim hidratar o cache é cópia, não tradução — e a
 * consolidação acontece aqui, na entrada.
 *
 * No delta só chegam os registros novos: finalidade sem registro no pacote
 * mantém o estado que já estava no aparelho.
 */
import type { ConsentPurpose, ConsentRecord, ConsentStatus } from '@fonte/api-client';

/** Mesmas finalidades do backend (`ConsentService.statusForSubject`). */
export const CONSENT_PURPOSES: ConsentPurpose[] = ['IMAGE_PUBLICATION', 'RELIGIOUS_DISCLOSURE'];

function latestFor(records: ConsentRecord[], purpose: ConsentPurpose): ConsentRecord | null {
  return records
    .filter((record) => record.purpose === purpose)
    .reduce<ConsentRecord | null>(
      (latest, record) =>
        !latest || record.createdAt >= latest.createdAt ? record : latest,
      null,
    );
}

export function mergeConsentStatuses(
  stored: ConsentStatus[] | null | undefined,
  records: ConsentRecord[],
): ConsentStatus[] {
  return CONSENT_PURPOSES.map((purpose) => {
    const current = stored?.find((status) => status.purpose === purpose) ?? {
      purpose,
      granted: false,
      termVersion: null,
      since: null,
    };
    const latest = latestFor(records, purpose);

    // Registro mais velho que o estado guardado não pode "desfazer" o que já foi
    // consolidado (ordem de chegada não é ordem de decisão).
    if (!latest || (current.since && latest.createdAt < current.since)) return current;

    return {
      purpose,
      granted: latest.granted === true,
      termVersion: latest.termVersion ?? null,
      since: latest.createdAt,
    };
  });
}
