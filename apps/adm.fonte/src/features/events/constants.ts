import type { RegistrationFieldType } from '@fonte/api-client';

/** Rótulos (pt-BR) dos tipos de campo do formulário de inscrição (story 68). */
export const REGISTRATION_FIELD_TYPE_LABELS: Record<RegistrationFieldType, string> = {
  short_text: 'Texto curto',
  long_text: 'Texto longo',
  number: 'Número',
  boolean: 'Sim/Não',
  select: 'Lista (escolha única)',
  multi_select: 'Lista (múltipla escolha)',
  date: 'Data',
  email: 'E-mail',
  phone: 'Telefone',
  file: 'Arquivo (upload)',
};
