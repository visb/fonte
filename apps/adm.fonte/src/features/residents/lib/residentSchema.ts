import { z } from 'zod';
import { FamilyInvestment, Gender, MaritalStatus, ResidentStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { maskCPF, maskRG, maskPhone } from './masks';

export const residentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  houseId: z.string().min(1, 'Casa é obrigatória'),
  status: z.nativeEnum(ResidentStatus).optional(),
  birthDate: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  nationality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  gender: z.nativeEnum(Gender).or(z.literal('')).optional(),
  address: z.string().optional(),
  entryDate: z.string().optional(),
  contactPhone: z.string().optional(),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
  maritalStatus: z.nativeEnum(MaritalStatus).or(z.literal('')).optional(),
  children: z.string().optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  religion: z.string().optional(),
  addiction: z.string().optional(),
  healthIssues: z.string().optional(),
  continuousMedication: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  familyInvestment: z.nativeEnum(FamilyInvestment).or(z.literal('')).optional().nullable(),
  // Coerced leniently: blank or non-numeric input (e.g. values the AI import may
  // carry over from the ficha like "isento"/"R$0") become null instead of failing.
  // The amount input only renders for NEGOTIATED, so a hidden invalid value must
  // never silently block submit on the other modalities (SOCIAL/BASKET/PAYMENT).
  familyInvestmentAmount: z
    .preprocess((v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }, z.number().int().min(0).nullable())
    .optional(),
  // Same lenient handling as the amount: the due-day select is hidden for SOCIAL,
  // and the AI import may carry the day as a number — coerce to string (or drop
  // empty/null) so a hidden value can't silently block submit.
  contributionDueDay: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : String(v)),
    z.string().optional(),
  ),
});

export type ResidentFormData = z.infer<typeof residentSchema>;

// Field groups for the multi-step admission wizard. Each step only advances
// when the fields it owns pass validation.
export const FICHA_FIELDS = [
  'name', 'cpf', 'rg', 'nationality', 'birthDate', 'gender',
  'address', 'city', 'state', 'contactPhone', 'email',
  'maritalStatus', 'children', 'occupation', 'education', 'religion', 'addiction',
  'healthIssues', 'continuousMedication', 'weight', 'height',
] as const satisfies readonly (keyof ResidentFormData)[];

export const ADMISSAO_FIELDS = [
  'houseId', 'entryDate', 'familyInvestment', 'familyInvestmentAmount', 'contributionDueDay',
] as const satisfies readonly (keyof ResidentFormData)[];

export function buildResidentPayload(data: ResidentFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value === undefined) {
      payload[key] = null;
      continue;
    }
    if (key === 'children' || key === 'weight' || key === 'height' || key === 'familyInvestmentAmount' || key === 'contributionDueDay') {
      payload[key] = Number(value);
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

export function residentToFormValues(r: Resident): ResidentFormData {
  const dateStr = (v: string | null) => (v ? v.split('T')[0] : '');
  const numStr = (v: number | null | undefined) => (v != null ? String(v) : '');
  return {
    name: r.name,
    houseId: r.houseId,
    status: r.status,
    birthDate: dateStr(r.birthDate),
    cpf: maskCPF(r.cpf ?? ''),
    rg: maskRG(r.rg ?? ''),
    nationality: r.nationality ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    gender: (r.gender as Gender) ?? '',
    address: r.address ?? '',
    entryDate: dateStr(r.entryDate),
    contactPhone: maskPhone(r.contactPhone ?? ''),
    email: r.email ?? '',
    maritalStatus: (r.maritalStatus as MaritalStatus) ?? '',
    children: numStr(r.children),
    occupation: r.occupation ?? '',
    education: r.education ?? '',
    religion: r.religion ?? '',
    addiction: r.addiction ?? '',
    healthIssues: r.healthIssues ?? '',
    continuousMedication: r.continuousMedication ?? '',
    weight: numStr(r.weight),
    height: numStr(r.height),
    familyInvestment: (r.familyInvestment as FamilyInvestment) ?? '',
    familyInvestmentAmount: r.familyInvestmentAmount ?? undefined,
    contributionDueDay: numStr(r.contributionDueDay),
  };
}
