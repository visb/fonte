import { MaritalStatus } from '@fonte/types';
import type { MissingField } from '../components/MissingFieldsDialog';
import type { Resident, UpdateResidentInput } from '@fonte/api-client';

// Nome de arquivo do PDF — mesma regra do backend (DocumentTemplateService),
// para o download individual e o combinado baterem com o filename do servidor.
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .split('')
    .filter((c) => c.charCodeAt(0) < 0x0300 || c.charCodeAt(0) > 0x036f)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// `signature` é a assinatura do USUÁRIO logado (staff), não um campo do filho:
// tem que ficar fora do gate de campos faltantes do resident (story 128), senão
// o MissingFieldsDialog dispara errado tratando-a como dado do acolhido faltante.
// `residentPhoto` (story 157) é campo do filho, mas a ausência de foto vira a
// MOLDURA VAZIA impressa — nunca bloqueia a geração, então também fica fora do
// gate. Está aqui de propósito (e testado), não por acaso de não existir no
// VAR_TO_FIELD.
// `exitDate` (story 159) é campo do filho, mas filho SEM saída é o caso normal
// (está ativo) e o backend imprime "não informado": pedir a data de saída de todo
// filho ativo, em todo documento que usasse a variável, seria ruído. Fica fora do
// gate de propósito (e testado), não por acaso de não existir no VAR_TO_FIELD.
const ALWAYS_AVAILABLE = new Set([
  'name', 'house', 'entryDate', 'exitDate', 'date', 'dateLong', 'signature', 'residentPhoto',
]);

interface VarMapping {
  residentField: keyof UpdateResidentInput;
  label: string;
  inputType: 'text' | 'date' | 'select';
  options?: { value: string; label: string }[];
  isEmpty: (r: Resident) => boolean;
}

const VAR_TO_FIELD: Record<string, VarMapping> = {
  cpf:          { residentField: 'cpf',           label: 'CPF',                inputType: 'text',   isEmpty: (r) => !r.cpf },
  rg:           { residentField: 'rg',            label: 'RG',                 inputType: 'text',   isEmpty: (r) => !r.rg },
  nationality:  { residentField: 'nationality',   label: 'Nacionalidade',      inputType: 'text',   isEmpty: (r) => !r.nationality },
  city:         { residentField: 'city',          label: 'Cidade',             inputType: 'text',   isEmpty: (r) => !r.city },
  state:        { residentField: 'state',         label: 'UF',                 inputType: 'text',   isEmpty: (r) => !r.state },
  birthDate:    { residentField: 'birthDate',     label: 'Data de nascimento', inputType: 'date',   isEmpty: (r) => !r.birthDate },
  age:          { residentField: 'birthDate',     label: 'Data de nascimento', inputType: 'date',   isEmpty: (r) => !r.birthDate },
  maritalStatus: {
    residentField: 'maritalStatus',
    label: 'Estado civil',
    inputType: 'select',
    options: [
      { value: MaritalStatus.SINGLE,   label: 'Solteiro(a)' },
      { value: MaritalStatus.MARRIED,  label: 'Casado(a)' },
      { value: MaritalStatus.DIVORCED, label: 'Divorciado(a)' },
    ],
    isEmpty: (r) => !r.maritalStatus,
  },
  address: { residentField: 'address',      label: 'Endereço', inputType: 'text', isEmpty: (r) => !r.address },
  phone:   { residentField: 'contactPhone', label: 'Telefone', inputType: 'text', isEmpty: (r) => !r.contactPhone },
};

export function extractTemplateVars(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

// Story 152 — as variáveis de VÁRIOS templates numa lista só (deduplicada), para
// o pré-voo do PDF combinado usar exatamente o mesmo gate do download individual.
export function extractTemplatesVars(templates: { content: string }[]): string[] {
  return [...new Set(templates.flatMap((t) => extractTemplateVars(t.content)))];
}

// Campos do filho que o(s) template(s) usam e que ainda estão vazios. Dedupe por
// `residentField`: {{age}} e {{birthDate}} pedem o mesmo dado, então o diálogo
// nunca mostra a mesma pergunta duas vezes — inclusive na união de templates.
export function findMissingFields(vars: string[], resident: Resident): MissingField[] {
  const seen = new Set<string>();
  const result: MissingField[] = [];
  for (const varName of vars) {
    if (ALWAYS_AVAILABLE.has(varName)) continue;
    const mapping = VAR_TO_FIELD[varName];
    if (!mapping) continue;
    const fieldKey = mapping.residentField as string;
    if (seen.has(fieldKey)) continue;
    if (!mapping.isEmpty(resident)) continue;
    seen.add(fieldKey);
    result.push({
      residentField: mapping.residentField,
      label: mapping.label,
      inputType: mapping.inputType,
      options: mapping.options,
    });
  }
  return result;
}
