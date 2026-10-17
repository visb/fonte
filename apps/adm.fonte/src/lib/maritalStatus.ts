import { MaritalStatus } from '@fonte/types';

/**
 * Story 210 — rótulos e opções do estado civil num lugar só. Selects e
 * exibições (filho, servo, readmissão, campos de documento) iteram sobre
 * estes dicionários: um valor novo no enum é uma linha aqui.
 */
export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  [MaritalStatus.SINGLE]: 'Solteiro(a)',
  [MaritalStatus.MARRIED]: 'Casado(a)',
  [MaritalStatus.STABLE_UNION]: 'União estável',
  [MaritalStatus.DIVORCED]: 'Divorciado(a)',
  [MaritalStatus.WIDOWED]: 'Viúvo(a)',
};

/** Ordem de exibição nos selects (decisão 3 da story 210). */
const MARITAL_STATUS_ORDER: MaritalStatus[] = [
  MaritalStatus.SINGLE,
  MaritalStatus.MARRIED,
  MaritalStatus.STABLE_UNION,
  MaritalStatus.DIVORCED,
  MaritalStatus.WIDOWED,
];

export const MARITAL_STATUS_OPTIONS: ReadonlyArray<{ value: MaritalStatus; label: string }> =
  MARITAL_STATUS_ORDER.map((value) => ({ value, label: MARITAL_STATUS_LABELS[value] }));

/** Rótulo para exibição; valor desconhecido aparece cru e vazio vira "—". */
export function maritalStatusLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return MARITAL_STATUS_LABELS[value as MaritalStatus] ?? value;
}
