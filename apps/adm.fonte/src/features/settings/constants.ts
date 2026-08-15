import { TemplateAvailability, TemplateKind } from '@fonte/types';

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

// Story 178 — os dois grupos da MESMA aba de templates. Aba nova só duplicaria
// chrome: o editor é o mesmo componente, o que muda é o dicionário de variáveis.
export const TEMPLATE_KIND_SECTIONS: {
  kind: TemplateKind;
  title: string;
  hint: string;
  emptyTitle: string;
  createLabel: string;
}[] = [
  {
    kind: TemplateKind.RESIDENT,
    title: 'Documentos do acolhido',
    hint: 'Templates com badge Acolhimento aparecem automaticamente na aba de Anexos do acolhido.',
    emptyTitle: 'Nenhum documento cadastrado.',
    // Rótulo preservado da story anterior: é o botão que o e2e do editor usa.
    createLabel: 'Novo template',
  },
  {
    kind: TemplateKind.RECEIPT,
    title: 'Recibos',
    hint: 'Um template por tipo de recibo. O recibo é gerado sob demanda e nunca aparece nos anexos do acolhido.',
    emptyTitle: 'Nenhum template de recibo cadastrado.',
    createLabel: 'Novo recibo',
  },
];
