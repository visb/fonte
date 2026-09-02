import { ReceiptType } from '@fonte/types';
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
  // Story 157 — variável de BLOCO: imprime a foto do acolhido (ou a moldura
  // vazia para colar à mão). `residentPhoto`, e não `photo`, deixa explícito de
  // quem é a foto e abre espaço para um `{{responsiblePhoto}}` futuro.
  { key: '{{residentPhoto}}', label: 'Foto do acolhido',   description: 'Foto do acolhido em 4×4 cm; moldura vazia com o rótulo "Foto" se não houver' },
  { key: '{{entryDate}}',     label: 'Data de entrada',    description: 'Data de entrada na comunidade (dd/mm/aaaa)' },
  // Story 159 — contraparte da entrada, logo abaixo dela para o par ficar lado a
  // lado na barra. Sem saída o backend imprime "não informado" (e não o traço).
  { key: '{{exitDate}}',      label: 'Data de saída',      description: 'Data de saída da comunidade (dd/mm/aaaa); "não informado" se o filho ainda está na casa' },
  { key: '{{date}}',          label: 'Data de hoje',       description: 'Data atual no momento da impressão (dd/mm/aaaa)' },
  { key: '{{dateLong}}',      label: 'Data por extenso',   description: 'Data atual por extenso (ex: 1 de junho de 2026)' },
  { key: '{{responsibleName}}',         label: 'Responsável — nome',       description: 'Nome do familiar marcado como responsável' },
  { key: '{{responsibleRelationship}}', label: 'Responsável — parentesco', description: 'Parentesco do responsável com o acolhido' },
  // Story 153 — variável condicional: evita o `não informado(não informado)` que
  // o par `{{responsibleName}}({{responsibleRelationship}})` imprimia à mão.
  { key: '{{responsibleWithRelationship}}', label: 'Responsável — nome e parentesco', description: 'Nome do responsável com o parentesco entre parênteses; "Responsável" se não houver' },
  { key: '{{responsiblePhone}}',        label: 'Responsável — telefone',   description: 'Telefone do familiar responsável' },
  { key: '{{signature}}',               label: 'Assinatura',               description: 'Assinatura do usuário que gerar o documento' },
];

// ─── Variáveis do RECIBO (story 178) ──────────────────────────────────────────
// Lista SEPARADA de propósito: um recibo não tem acolhido, então oferecer
// {{name}}/{{residentPhoto}} no painel só convidaria a imprimir "não informado".
// `{{signature}}` é a única compartilhada — recibo também é assinado por quem
// emitiu. Nome/CNPJ/endereço da entidade vão DIGITADOS no corpo (decisão 7).
//
// Story 193 — a lista virou uma POR TIPO (`RECEIPT_VARIABLES_BY_TYPE`): o
// recibo do acolhido não pode oferecer `{{netAmount}}` (não há gateway no carnê
// do filho) e o do associado não pode oferecer `{{residentName}}`. Uma lista só
// para os dois voltaria a convidar o operador a imprimir token vazio.
const ASSOCIATE_RECEIPT_VARIABLES: TemplateVariable[] = [
  { key: '{{receiptNumber}}',  label: 'Número do recibo',  description: 'Sequencial por tipo de recibo, com 6 dígitos (ex: 000123)' },
  { key: '{{payerName}}',      label: 'Pagador — nome',    description: 'Nome do associado que pagou a contribuição' },
  { key: '{{payerCpf}}',       label: 'Pagador — CPF',     description: 'CPF do pagador formatado (000.000.000-00)' },
  { key: '{{amount}}',         label: 'Valor pago',        description: 'Valor bruto pago pelo associado (ex: R$ 50,00)' },
  { key: '{{amountInWords}}',  label: 'Valor por extenso', description: 'Valor pago escrito por extenso (ex: cinquenta reais)' },
  { key: '{{netAmount}}',      label: 'Valor líquido',     description: 'Valor líquido, já descontada a taxa do gateway' },
  { key: '{{feeAmount}}',      label: 'Taxa',              description: 'Taxa do meio de pagamento embutida no valor pago' },
  { key: '{{referenceMonth}}', label: 'Competência',       description: 'Mês de referência da contribuição (ex: agosto/2026)' },
  { key: '{{paymentDate}}',    label: 'Data do pagamento', description: 'Data em que a cobrança foi paga (dd/mm/aaaa)' },
  { key: '{{dueDate}}',        label: 'Vencimento',        description: 'Data de vencimento da cobrança (dd/mm/aaaa)' },
  { key: '{{date}}',           label: 'Data de hoje',      description: 'Data de emissão do recibo (dd/mm/aaaa)' },
  { key: '{{dateLong}}',       label: 'Data por extenso',  description: 'Data de emissão por extenso (ex: 1 de junho de 2026)' },
  { key: '{{signature}}',      label: 'Assinatura',        description: 'Assinatura do usuário que emitir o recibo' },
];

// Recibo da contribuição mensal do ACOLHIDO (story 193). Pagador e acolhido são
// tokens separados: a parcela é do filho, quem paga é a família (decisão 1).
const RESIDENT_RECEIPT_VARIABLES: TemplateVariable[] = [
  { key: '{{receiptNumber}}',     label: 'Número do recibo',      description: 'Sequencial por tipo de recibo, com 6 dígitos (ex: 000123)' },
  { key: '{{payerName}}',         label: 'Pagador — nome',        description: 'Nome do familiar responsável; o nome do acolhido quando não houver responsável cadastrado' },
  { key: '{{payerCpf}}',          label: 'Pagador — CPF',         description: 'CPF do familiar responsável, formatado (000.000.000-00)' },
  { key: '{{payerRelationship}}', label: 'Pagador — parentesco',  description: 'Parentesco do responsável com o acolhido (ex: Mãe)' },
  { key: '{{residentName}}',      label: 'Acolhido — nome',       description: 'Nome do acolhido a que a contribuição se refere' },
  { key: '{{residentCpf}}',       label: 'Acolhido — CPF',        description: 'CPF do acolhido, formatado (000.000.000-00)' },
  { key: '{{houseName}}',         label: 'Casa',                  description: 'Nome da casa onde o acolhido está' },
  { key: '{{amount}}',            label: 'Valor pago',            description: 'Valor efetivamente pago pela família (ex: R$ 500,00)' },
  { key: '{{amountInWords}}',     label: 'Valor por extenso',     description: 'Valor pago escrito por extenso (ex: quinhentos reais)' },
  { key: '{{referenceMonth}}',    label: 'Competência',           description: 'Mês de referência da contribuição (ex: agosto/2026)' },
  { key: '{{paymentDate}}',       label: 'Data do pagamento',     description: 'Data em que a parcela foi paga (dd/mm/aaaa)' },
  { key: '{{dueDate}}',           label: 'Vencimento',            description: 'Data de vencimento da parcela (dd/mm/aaaa)' },
  { key: '{{paymentMethod}}',     label: 'Forma de pagamento',    description: 'Dinheiro, PIX, Cesta… (vazio quando não informada)' },
  { key: '{{contributionPlan}}',  label: 'Modalidade',            description: 'Modalidade de contribuição efetivamente paga (ex: R$ 500 + cestas)' },
  { key: '{{date}}',              label: 'Data de hoje',          description: 'Data de emissão do recibo (dd/mm/aaaa)' },
  { key: '{{dateLong}}',          label: 'Data por extenso',      description: 'Data de emissão por extenso (ex: 1 de junho de 2026)' },
  { key: '{{signature}}',         label: 'Assinatura',            description: 'Assinatura do usuário que emitir o recibo' },
];

/**
 * Catálogo de variáveis POR TIPO de recibo. Pizza e pão ainda não têm resolver
 * (nem template cadastrável), mas o `Record` completo quebra o build se um tipo
 * novo entrar no enum sem lista — de propósito, como o mapa de filename do
 * backend.
 */
export const RECEIPT_VARIABLES_BY_TYPE: Record<ReceiptType, TemplateVariable[]> = {
  [ReceiptType.ASSOCIATE_CONTRIBUTION]: ASSOCIATE_RECEIPT_VARIABLES,
  [ReceiptType.RESIDENT_CONTRIBUTION]: RESIDENT_RECEIPT_VARIABLES,
  [ReceiptType.PIZZA_SALE]: ASSOCIATE_RECEIPT_VARIABLES,
  [ReceiptType.BREAD_SALE]: ASSOCIATE_RECEIPT_VARIABLES,
};

/**
 * Lista do template de recibo em edição. Tipo ausente (template legado ou
 * payload sem `receiptType`) cai no do associado — o único que existia antes da
 * story 193, e portanto o único que um template sem tipo pode ser.
 */
export function receiptVariablesFor(
  receiptType: ReceiptType | string | null | undefined,
): TemplateVariable[] {
  const list = receiptType ? RECEIPT_VARIABLES_BY_TYPE[receiptType as ReceiptType] : undefined;
  return list ?? ASSOCIATE_RECEIPT_VARIABLES;
}

// Máximo de sugestões mostradas no popup do autocomplete inline (story 144).
export const MAX_SUGGESTIONS = 8;

// ─── filterVariables ──────────────────────────────────────────────────────────
// Filtro puro do autocomplete: casa o texto digitado após `{{` contra `label` E
// `key`, accent-insensitive e case-insensitive (via normalizeForSearch). Query
// vazia devolve a lista completa (o `items` da extensão fatia em MAX_SUGGESTIONS).
// Sem match → lista vazia. Testável sem ProseMirror.
// Story 178 — `source` opcional: o autocomplete de um template de RECIBO filtra
// RECEIPT_VARIABLES. Default `VARIABLES` para o documento do acolhido seguir
// exatamente como estava.
export function filterVariables(
  query: string,
  source: TemplateVariable[] = VARIABLES,
): TemplateVariable[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return source;
  return source.filter(
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
