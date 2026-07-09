import { ResidentStatus } from '@fonte/types';
import type {
  CommitImportPayload,
  CommitImportRelative,
  CreateResidentInput,
  House,
  ImportAdmission,
  ImportPreviewResult,
} from '@fonte/api-client';
import { normalizeForSearch } from '@/lib/utils';
import { normalizePhoneWithDefaultDDD } from '@/lib/masks';
import { RELATIONSHIP_OPTIONS } from '../constants';
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

/**
 * Meses completos entre duas datas ISO (`YYYY-MM-DD`) — espelha `monthsBetween`
 * do backend (story 120): um mês só conta quando o dia final alcança o inicial.
 */
export function monthsBetweenIso(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = endIso.slice(0, 10).split('-').map(Number);
  let months = (ey - sy) * 12 + (em - sm);
  if (ed < sd) months -= 1;
  return Math.max(0, months);
}

/**
 * Status terminal previsto para um acolhimento a partir da permanência
 * entrada→saída (story 120/121): ≥ 6 meses → alta (`DISCHARGED`); < 6 meses →
 * evasão (`EVADED`). Acolhimento sem saída (em aberto) → `ACTIVE`. Usado só para
 * exibição read-only no review — o backend deriva o valor final no commit.
 */
export function predictAdmissionStatus(admission: ImportAdmission): ResidentStatus {
  if (!admission.exitDate) return ResidentStatus.ACTIVE;
  return monthsBetweenIso(admission.entryDate, admission.exitDate) >= 6
    ? ResidentStatus.DISCHARGED
    : ResidentStatus.EVADED;
}

/**
 * Status default de um item do import a partir do cross-match com a planilha:
 * ficha sem correspondência (`unmatched`) entra como ARCHIVED (arquivo morto) —
 * regra de negócio do import em lote. Ficha casada não força nada (`''` deixa
 * o fluxo normal decidir: exitDate deriva Alta/Evasão no backend, senão ACTIVE).
 * Status já extraído da ficha tem precedência.
 */
export function defaultImportStatus(preview: ImportPreviewResult | null): ResidentStatus | '' {
  if (!preview) return '';
  const extracted = (preview.resident as { status?: unknown }).status;
  if (typeof extracted === 'string' && extracted) return extracted as ResidentStatus;
  return preview.matchStatus === 'unmatched' ? ResidentStatus.ARCHIVED : '';
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

/**
 * Histórico de acolhimentos detectado na planilha (story 121), que viaja em
 * `preview.resident.admissions`. Read-only: alimenta a exibição no review e o
 * payload de commit (o backend cria um `Admission` por par). Retorna [] quando
 * ausente ou mal-formado.
 */
export function admissionsFromPreview(preview: ImportPreviewResult): ImportAdmission[] {
  const raw = (preview.resident as { admissions?: unknown }).admissions;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is ImportAdmission =>
      typeof a === 'object' && a !== null && typeof (a as ImportAdmission).entryDate === 'string',
  );
}

/**
 * Casa o parentesco extraído pela IA (ex.: "pai", "mãe", "MAE") com o rótulo
 * canônico das opções (ex.: "Pai", "Mãe"), ignorando caixa e acento. Sem esse
 * casamento o `<Select>` (match exato) exibe vazio mesmo com o dado presente.
 * Retorna o valor original (aparado) quando não há opção equivalente.
 */
export function normalizeRelationship(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const target = normalizeForSearch(raw);
  const match = RELATIONSHIP_OPTIONS.find(
    (o) => o !== 'Outro' && normalizeForSearch(o) === target,
  );
  return match ?? raw;
}

/** Familiares do preview no formato mínimo do commit (nome + telefone + parentesco). */
export function relativesFromPreview(preview: ImportPreviewResult): CommitImportRelative[] {
  return preview.relatives
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      // Telefone do familiar vem cru da extração; mascara e assume DDD 41 se faltar.
      phone: r.phone?.trim() ? normalizePhoneWithDefaultDDD(r.phone) : null,
      // Parentesco vem cru da IA ("pai"/"mãe"); casa com o rótulo canônico da lista.
      relationship: normalizeRelationship(r.relationship) || null,
    }));
}

/** Monta o payload de commit a partir da ficha (form) + extras do preview. */
export function buildCommitPayload(
  formValues: ResidentFormData,
  extras: {
    relatives: CommitImportRelative[];
    contributionMonths: string[];
    photoBase64?: string | null;
    admissions?: ImportAdmission[];
  },
): CommitImportPayload {
  const resident = buildResidentPayload(formValues) as unknown as CreateResidentInput;
  // Só envia o histórico quando há mais de um acolhimento — um único acolhimento
  // já é criado pelo topo do resident (não precisa de `Admission` extra).
  const admissions = extras.admissions && extras.admissions.length > 1 ? extras.admissions : undefined;
  return {
    resident: {
      ...resident,
      status: (formValues.status as ResidentStatus) || ResidentStatus.ACTIVE,
      ...(admissions ? { admissions } : {}),
    },
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
    // Ficha fora da planilha entra como ARCHIVED (regra do import em lote).
    status: defaultImportStatus(preview),
  } as ResidentFormData;
  return buildCommitPayload(formValues, {
    relatives: relativesFromPreview(preview),
    contributionMonths: preview.contributionMonths ?? [],
    photoBase64: preview.photoBase64,
    admissions: admissionsFromPreview(preview),
  });
}
