import { ResidentStatus } from '@fonte/types';
import type {
  CommitImportPayload,
  CommitImportRelative,
  CreateResidentInput,
  House,
  ImportPreviewResult,
} from '@fonte/api-client';
import { normalizeForSearch } from '@/lib/utils';
import { normalizePhoneWithDefaultDDD } from '@/lib/masks';
import { buildResidentPayload, type ResidentFormData } from './residentSchema';

/**
 * Constrói o payload de commit do import (story 103/105) a partir da ficha
 * revisada + os familiares e o histórico de contribuição do preview enriquecido
 * (story 102). É a fonte única usada tanto pela aprovação direta no card quanto
 * pela aprovação dentro do modal — as duas persistem o mesmo formato.
 */

/**
 * UF padrão do import (story 119): a comunidade é do Paraná e a maioria dos
 * filhos também, então quando a extração não traz a UF assumimos "PR" como
 * conveniência. Continua editável na revisão e não sobrescreve UF já extraída.
 */
export const DEFAULT_IMPORT_STATE = 'PR';

/** UF do import: mantém a extraída; cai no default só quando vazia. */
export function defaultImportState(state: unknown): string {
  return (typeof state === 'string' ? state.trim() : '') || DEFAULT_IMPORT_STATE;
}

// Campos que o formulário do resident conhece; usados para filtrar o preview
// (Record<string, unknown>) ao pré-carregar o rhf, sem carregar lixo extra.
const FORM_KEYS = [
  'name', 'houseId', 'status', 'birthDate', 'cpf', 'rg', 'nationality', 'city', 'state',
  'gender', 'address', 'entryDate', 'exitDate', 'contactPhone', 'email', 'maritalStatus', 'children',
  'occupation', 'education', 'religion', 'addiction', 'healthIssues', 'continuousMedication',
  'weight', 'height', 'familyInvestment', 'familyInvestmentAmount', 'contributionDueDay',
] as const satisfies readonly (keyof ResidentFormData)[];

/** Extrai do preview (Record) só os campos do formulário, já como string. */
export function previewToFormValues(
  resident: Record<string, unknown>,
): Partial<ResidentFormData> {
  const values: Record<string, unknown> = {};
  for (const key of FORM_KEYS) {
    const v = resident[key];
    if (v === null || v === undefined || v === '') continue;
    if (key === 'contactPhone') {
      // Telefone do filho vem cru da extração; mascara e assume DDD 41 se faltar.
      values[key] = normalizePhoneWithDefaultDDD(String(v));
      continue;
    }
    values[key] = typeof v === 'number' ? String(v) : v;
  }
  // UF padrão "PR" quando a extração não trouxe a UF (story 119). Não sobrescreve
  // a extraída — só preenche o vazio, e o campo segue editável na revisão.
  values.state = defaultImportState(values.state);
  return values as Partial<ResidentFormData>;
}

/** Casa o nome da casa (aba/ficha) com o `id` da casa cadastrada. */
export function resolveHouseId(houseName: string | null, houses: House[]): string {
  const target = normalizeForSearch(houseName ?? '').trim();
  if (!target) return '';
  const found = houses.find((h) => {
    const name = normalizeForSearch(h.name);
    return name.includes(target) || target.includes(name);
  });
  return found?.id ?? '';
}

/** Familiares do preview no formato mínimo do commit (nome + telefone + parentesco). */
export function relativesFromPreview(preview: ImportPreviewResult): CommitImportRelative[] {
  return preview.relatives
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      // Telefone do familiar vem cru da extração; mascara e assume DDD 41 se faltar.
      phone: r.phone?.trim() ? normalizePhoneWithDefaultDDD(r.phone) : null,
      relationship: r.relationship?.trim() || null,
    }));
}

/** Monta o payload de commit a partir da ficha (form) + extras do preview. */
export function buildCommitPayload(
  formValues: ResidentFormData,
  extras: {
    relatives: CommitImportRelative[];
    contributionMonths: string[];
    photoBase64?: string | null;
  },
): CommitImportPayload {
  const resident = buildResidentPayload(formValues) as unknown as CreateResidentInput;
  return {
    resident: { ...resident, status: (formValues.status as ResidentStatus) || ResidentStatus.ACTIVE },
    relatives: extras.relatives,
    contributionMonths: extras.contributionMonths ?? [],
    photoBase64: extras.photoBase64 ?? null,
  };
}

/**
 * Payload de commit direto a partir do preview (aprovação pelo card, sem abrir o
 * modal): resolve a casa pelo nome e reusa os familiares/contribuições/foto já
 * extraídos. A ficha vai como veio da extração enriquecida.
 */
export function buildCommitPayloadFromPreview(
  preview: ImportPreviewResult,
  houses: House[],
): CommitImportPayload {
  const formValues = {
    ...previewToFormValues(preview.resident),
    houseId: resolveHouseId(preview.matchedHouseName ?? preview.houseName, houses),
  } as ResidentFormData;
  return buildCommitPayload(formValues, {
    relatives: relativesFromPreview(preview),
    contributionMonths: preview.contributionMonths ?? [],
    photoBase64: preview.photoBase64,
  });
}
