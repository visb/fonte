import type { RegistrationFieldType } from '@fonte/api-client';
import { EventPaymentStatus } from '@fonte/api-client';

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

/** Rótulos (pt-BR) do status de pagamento da inscrição (story 69). */
export const EVENT_PAYMENT_STATUS_LABELS: Record<EventPaymentStatus, string> = {
  [EventPaymentStatus.NONE]: 'Grátis',
  [EventPaymentStatus.PENDING]: 'Aguardando pagamento',
  [EventPaymentStatus.PAID]: 'Pago',
  [EventPaymentStatus.FAILED]: 'Falhou',
};

/** Classe de cor do badge por status de pagamento (story 69). */
export const EVENT_PAYMENT_STATUS_BADGE: Record<EventPaymentStatus, string> = {
  [EventPaymentStatus.NONE]: 'bg-muted text-muted-foreground',
  [EventPaymentStatus.PENDING]: 'bg-amber-100 text-amber-800',
  [EventPaymentStatus.PAID]: 'bg-emerald-100 text-emerald-800',
  [EventPaymentStatus.FAILED]: 'bg-red-100 text-red-800',
};
