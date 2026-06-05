import type { House } from '@fonte/api-client';
import { FamilyInvestment, Gender, MaritalStatus } from '@fonte/types';
import {
  FAMILY_INVESTMENT_LABELS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
} from '../constants';
import type { ResidentFormData } from './residentSchema';

// Resolution context passed to formatters that need external data (e.g. resolving
// a houseId to its house name).
export interface SummaryFormatContext {
  houses: House[];
}

export interface SummaryFieldDef {
  key: keyof ResidentFormData;
  label: string;
  format?: (value: unknown, ctx: SummaryFormatContext) => string;
}

export interface SummarySection {
  title: string;
  fields: SummaryFieldDef[];
}

// Formats an ISO date string (YYYY-MM-DD or full ISO) to pt-BR. Anchors to local
// midnight so the day never shifts due to timezone.
function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const dateOnly = value.split('T')[0];
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('pt-BR');
}

function houseName(value: unknown, { houses }: SummaryFormatContext): string {
  if (typeof value !== 'string' || !value) return '';
  const found = houses.find((h) => h.id === value);
  return found ? found.name : value;
}

// Mirrors the sections of ResidentFormSections.tsx so the confirmation screen
// shows every field the wizard collects, grouped exactly as it was filled in.
export const RESIDENT_SUMMARY_SECTIONS: SummarySection[] = [
  {
    title: 'Ficha de cadastro',
    fields: [
      { key: 'name', label: 'Nome' },
      { key: 'cpf', label: 'CPF' },
      { key: 'rg', label: 'RG' },
      { key: 'nationality', label: 'Nacionalidade' },
      { key: 'birthDate', label: 'Nascimento', format: formatDate },
      {
        key: 'gender',
        label: 'Gênero',
        format: (v) => GENDER_LABELS[v as Gender] ?? '',
      },
      { key: 'address', label: 'Endereço' },
      { key: 'city', label: 'Cidade' },
      { key: 'state', label: 'UF' },
      { key: 'contactPhone', label: 'Telefone' },
      { key: 'email', label: 'E-mail' },
      {
        key: 'maritalStatus',
        label: 'Estado civil',
        format: (v) => MARITAL_STATUS_LABELS[v as MaritalStatus] ?? '',
      },
      { key: 'children', label: 'Filhos' },
      { key: 'occupation', label: 'Ocupação' },
      { key: 'education', label: 'Escolaridade' },
      { key: 'religion', label: 'Religião' },
      { key: 'addiction', label: 'Dependência' },
      { key: 'healthIssues', label: 'Problemas de saúde' },
      { key: 'continuousMedication', label: 'Medicação contínua' },
      { key: 'weight', label: 'Peso (kg)' },
      { key: 'height', label: 'Altura (cm)' },
    ],
  },
  {
    title: 'Admissão',
    fields: [
      { key: 'houseId', label: 'Casa', format: houseName },
      { key: 'entryDate', label: 'Entrada', format: formatDate },
      {
        key: 'familyInvestment',
        label: 'Modalidade',
        format: (v) => FAMILY_INVESTMENT_LABELS[v as FamilyInvestment] ?? '',
      },
      {
        key: 'familyInvestmentAmount',
        label: 'Valor negociado',
        format: (v) => (v == null || v === '' ? '' : `R$ ${v}`),
      },
      {
        key: 'contributionDueDay',
        label: 'Dia de vencimento',
        format: (v) => (v == null || v === '' ? '' : `Dia ${v}`),
      },
    ],
  },
];

// Resolves a field's display value, applying its formatter when present and
// returning an empty string for blank/null values (so empty fields are skipped).
export function formatSummaryValue(
  value: unknown,
  ctx: SummaryFormatContext,
  format?: SummaryFieldDef['format'],
): string {
  if (value == null || value === '') return '';
  if (format) return format(value, ctx);
  return String(value);
}
