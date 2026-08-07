import { TemplateAvailability } from '@fonte/types';

// Story 160 — disponibilidade do template por status do filho. "Ativo" agrupa
// pré-admissão, ativo, castigo e saída temporária (o filho ainda é acolhido);
// "não-ativo" é quem já saiu ou é registro morto (alta, evasão, contagem,
// arquivo). O agrupamento em si vive em @fonte/types — aqui só os rótulos.
export const TEMPLATE_AVAILABILITY_OPTIONS: { value: TemplateAvailability; label: string }[] = [
  { value: TemplateAvailability.ALL, label: 'Todos' },
  { value: TemplateAvailability.ACTIVE_ONLY, label: 'Só filhos ativos' },
  { value: TemplateAvailability.INACTIVE_ONLY, label: 'Só filhos não-ativos' },
];

export const TEMPLATE_AVAILABILITY_HINT =
  'Ativo inclui pré-admissão, castigo e saída temporária. Não-ativo é alta, evasão, contagem e arquivo.';

// Rótulo da badge do card. ALL não ganha badge: é o comportamento padrão.
export const TEMPLATE_AVAILABILITY_BADGE: Partial<Record<TemplateAvailability, string>> = {
  [TemplateAvailability.ACTIVE_ONLY]: 'Só ativos',
  [TemplateAvailability.INACTIVE_ONLY]: 'Só não-ativos',
};
