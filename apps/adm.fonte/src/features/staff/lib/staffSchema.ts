import { z } from 'zod';
import { Gender, MaritalStatus, Role, ServantRank } from '@fonte/types';
import type { CreateStaffInput, Staff } from '@fonte/api-client';
import { maskCPF, maskRG, maskPhone } from '@/lib/masks';

// Campos comuns a criação e edição de servo, agrupados pelas abas do form
// (story 96). SÓ a aba Sistema tem campos obrigatórios (name, role e — via
// refine — house/group). As abas Pessoal e Endereço/Contato são 100% opcionais.
// Senha existe apenas na criação.
const baseShape = {
  // Aba Sistema/Acesso (obrigatórios)
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
  role: z.enum([Role.ADMIN, Role.COORDINATOR, Role.SERVANT], {
    required_error: 'Função é obrigatória',
  }),
  rank: z.nativeEnum(ServantRank).optional(),
  servesInGroup: z.boolean(),
  houseId: z.string().optional().or(z.literal('')),
  supportGroupId: z.string().optional().or(z.literal('')),
  // Aba Pessoal (opcionais)
  cpf: z.string().optional(),
  rg: z.string().optional(),
  nationality: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.nativeEnum(Gender).or(z.literal('')).optional(),
  maritalStatus: z.nativeEnum(MaritalStatus).or(z.literal('')).optional(),
  children: z.string().optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  religion: z.string().optional(),
  // Aba Endereço e contato (opcionais)
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  contactPhone: z.string().optional(),
};

// Mapa aba → campos. Usado pelas páginas para sinalizar qual aba tem erro de
// validação. A senha vive na aba Sistema apenas na criação.
export const STAFF_TAB_FIELDS = {
  system: ['name', 'email', 'password', 'role', 'rank', 'servesInGroup', 'houseId', 'supportGroupId'],
  personal: ['cpf', 'rg', 'nationality', 'birthDate', 'gender', 'maritalStatus', 'children', 'occupation', 'education', 'religion'],
  address: ['address', 'city', 'state', 'contactPhone'],
} as const;

export type StaffTabId = keyof typeof STAFF_TAB_FIELDS;

// Dado o conjunto de chaves com erro, retorna quais abas devem ser sinalizadas.
export function staffTabsWithError(errorKeys: string[]): Record<StaffTabId, boolean> {
  const has = (id: StaffTabId) => STAFF_TAB_FIELDS[id].some((f) => errorKeys.includes(f));
  return { system: has('system'), personal: has('personal'), address: has('address') };
}

// Refinamentos inline (não genéricos): manter a inferência concreta de cada
// schema. Um helper genérico sobre z.ZodTypeAny faria z.infer colapsar para
// `any`, quebrando a tipagem de FieldErrors nos formulários.
type ServiceFields = { servesInGroup: boolean; houseId?: string; supportGroupId?: string };

const houseRequired = (d: ServiceFields) => d.servesInGroup || !!d.houseId;
const groupRequired = (d: ServiceFields) => !d.servesInGroup || !!d.supportGroupId;

export const newStaffSchema = z
  .object({ ...baseShape, password: z.string().min(6) })
  .refine(houseRequired, { message: 'Casa é obrigatória para servos da casa', path: ['houseId'] })
  .refine(groupRequired, { message: 'Grupo de apoio é obrigatório', path: ['supportGroupId'] });

export const editStaffSchema = z
  .object(baseShape)
  .refine(houseRequired, { message: 'Casa é obrigatória para servos da casa', path: ['houseId'] })
  .refine(groupRequired, { message: 'Grupo de apoio é obrigatório', path: ['supportGroupId'] });

export type NewStaffFormData = z.infer<typeof newStaffSchema>;
export type EditStaffFormData = z.infer<typeof editStaffSchema>;

const str = (v?: string) => (v && v.trim() !== '' ? v.trim() : null);
const num = (v?: string) => {
  const n = str(v);
  return n != null ? Number(n) : null;
};

// Monta o payload comum (sem senha). A página adiciona a senha na criação.
export function buildStaffPayload(
  data: NewStaffFormData | EditStaffFormData,
): Omit<CreateStaffInput, 'password'> {
  return {
    name: data.name,
    email: data.email || null,
    role: data.role,
    houseId: data.servesInGroup ? null : data.houseId || null,
    supportGroupId: data.servesInGroup ? data.supportGroupId || null : null,
    phone: str(data.contactPhone),
    rank: data.role === Role.SERVANT ? data.rank ?? ServantRank.ASPIRANTE : null,
    cpf: str(data.cpf),
    rg: str(data.rg),
    nationality: str(data.nationality),
    birthDate: str(data.birthDate),
    gender: data.gender || null,
    address: str(data.address),
    city: str(data.city),
    state: str(data.state),
    maritalStatus: data.maritalStatus || null,
    children: num(data.children) ?? 0,
    occupation: str(data.occupation),
    education: str(data.education),
    religion: str(data.religion),
  };
}

export function staffToFormValues(staff: Staff): EditStaffFormData {
  const dateStr = (v: string | null) => (v ? v.split('T')[0] : '');
  const numStr = (v: number | null | undefined) => (v != null ? String(v) : '');
  return {
    name: staff.name,
    email: staff.user.email ?? '',
    role: staff.user.role as EditStaffFormData['role'],
    rank: staff.rank ?? ServantRank.ASPIRANTE,
    servesInGroup: !staff.houseId,
    houseId: staff.houseId ?? '',
    supportGroupId: staff.supportGroupId ?? '',
    cpf: maskCPF(staff.cpf ?? ''),
    rg: maskRG(staff.rg ?? ''),
    nationality: staff.nationality ?? '',
    birthDate: dateStr(staff.birthDate),
    gender: (staff.gender as Gender) ?? '',
    address: staff.address ?? '',
    city: staff.city ?? '',
    state: staff.state ?? '',
    contactPhone: maskPhone(staff.phone ?? ''),
    maritalStatus: (staff.maritalStatus as MaritalStatus) ?? '',
    children: numStr(staff.children),
    occupation: staff.occupation ?? '',
    education: staff.education ?? '',
    religion: staff.religion ?? '',
  };
}
