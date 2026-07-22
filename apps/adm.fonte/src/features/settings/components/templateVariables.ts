import { normalizeForSearch } from '@/lib/utils';

// ─── templateVariables ────────────────────────────────────────────────────────
// Fonte ÚNICA das variáveis de template no frontend (só apresentação; a
// substituição real acontece no backend). Extraída do `VariablesPanel` (story
// 144) para um módulo irmão sem JSX/estado, de modo que tanto a barra
// (`VariablesPanel`) quanto o autocomplete inline (`VariableSuggestion`)
// consumam a MESMA lista, sem duplicar rótulos/chaves e sem dependência circular
// editor↔panel.

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
}

export const VARIABLES: TemplateVariable[] = [
  { key: '{{name}}',          label: 'Nome completo',      description: 'Nome completo do acolhido' },
  { key: '{{cpf}}',           label: 'CPF',                description: 'CPF formatado (000.000.000-00)' },
  { key: '{{rg}}',            label: 'RG',                 description: 'Registro Geral do acolhido' },
  { key: '{{nationality}}',   label: 'Nacionalidade',      description: 'Nacionalidade do acolhido' },
  { key: '{{city}}',          label: 'Cidade',             description: 'Cidade de residência do acolhido' },
  { key: '{{state}}',         label: 'UF',                 description: 'Estado (sigla) de residência do acolhido' },
  { key: '{{birthDate}}',     label: 'Data de nascimento', description: 'Data de nascimento no formato dd/mm/aaaa' },
  { key: '{{age}}',           label: 'Idade',              description: 'Idade atual calculada em anos' },
  { key: '{{maritalStatus}}', label: 'Estado civil',       description: 'Solteiro(a), Casado(a) ou Divorciado(a)' },
  { key: '{{address}}',       label: 'Endereço',           description: 'Endereço residencial do acolhido' },
  { key: '{{phone}}',         label: 'Telefone',           description: 'Telefone de contato do acolhido' },
  { key: '{{house}}',         label: 'Nome da casa',       description: 'Nome da unidade de acolhimento' },
  { key: '{{houseName}}',     label: 'Casa — nome',        description: 'Nome da casa onde o acolhido está' },
  { key: '{{houseAddress}}',  label: 'Casa — endereço',    description: 'Endereço da casa onde o acolhido está' },
  { key: '{{houseCity}}',     label: 'Casa — cidade',      description: 'Cidade da casa onde o acolhido está' },
  { key: '{{houseState}}',    label: 'Casa — UF',          description: 'Estado (sigla) da casa onde o acolhido está' },
  { key: '{{entryDate}}',     label: 'Data de entrada',    description: 'Data de entrada na comunidade (dd/mm/aaaa)' },
  { key: '{{date}}',          label: 'Data de hoje',       description: 'Data atual no momento da impressão (dd/mm/aaaa)' },
  { key: '{{dateLong}}',      label: 'Data por extenso',   description: 'Data atual por extenso (ex: 1 de junho de 2026)' },
  { key: '{{responsibleName}}',         label: 'Responsável — nome',       description: 'Nome do familiar marcado como responsável' },
  { key: '{{responsibleRelationship}}', label: 'Responsável — parentesco', description: 'Parentesco do responsável com o acolhido' },
  { key: '{{responsiblePhone}}',        label: 'Responsável — telefone',   description: 'Telefone do familiar responsável' },
  { key: '{{signature}}',               label: 'Assinatura',               description: 'Assinatura do usuário que gerar o documento' },
];

// Máximo de sugestões mostradas no popup do autocomplete inline (story 144).
export const MAX_SUGGESTIONS = 8;

// ─── filterVariables ──────────────────────────────────────────────────────────
// Filtro puro do autocomplete: casa o texto digitado após `{{` contra `label` E
// `key`, accent-insensitive e case-insensitive (via normalizeForSearch). Query
// vazia devolve a lista completa (o `items` da extensão fatia em MAX_SUGGESTIONS).
// Sem match → lista vazia. Testável sem ProseMirror.
export function filterVariables(query: string): TemplateVariable[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return VARIABLES;
  return VARIABLES.filter(
    ({ key, label }) =>
      normalizeForSearch(label).includes(q) || normalizeForSearch(key).includes(q),
  );
}

// ─── buildVariableInsertion ───────────────────────────────────────────────────
// Dado o `key` escolhido, devolve o token COMPLETO a inserir no lugar do trecho
// `{{parcial` digitado. Normaliza as chaves para exatamente UM par `{{ }}` —
// aceita a key já embrulhada (`{{name}}`) ou nua (`name`) e nunca duplica as
// chaves (garante que a substituição não vire `{{{{name}}` nem `{{name}}}}`).
export function buildVariableInsertion(key: string): string {
  const bare = key.replace(/^\{+/, '').replace(/\}+$/, '').trim();
  return `{{${bare}}}`;
}
