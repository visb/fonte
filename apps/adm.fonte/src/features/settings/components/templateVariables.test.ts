import { describe, expect, it } from 'vitest';
import { ReceiptType } from '@fonte/types';
import {
  RECEIPT_VARIABLES_BY_TYPE,
  VARIABLES,
  buildVariableInsertion,
  filterVariables,
  receiptVariablesFor,
} from './templateVariables';

// ─── VARIABLES ────────────────────────────────────────────────────────────────
// Story 153 — a lista é a fonte ÚNICA que alimenta a barra e o autocomplete: se
// a entrada não estiver aqui, o operador não descobre a variável no editor.

describe('VARIABLES', () => {
  it('inclui {{responsibleWithRelationship}} com rótulo e descrição próprios (story 153)', () => {
    const variable = VARIABLES.find((v) => v.key === '{{responsibleWithRelationship}}');
    expect(variable).toBeDefined();
    expect(variable!.label).toBe('Responsável — nome e parentesco');
    expect(variable!.description).toBe(
      'Nome do responsável com o parentesco entre parênteses; "Responsável" se não houver',
    );
  });

  it('mantém {{responsibleName}} e {{responsibleRelationship}} na lista (decisão 6 — aditivo)', () => {
    const keys = VARIABLES.map((v) => v.key);
    expect(keys).toContain('{{responsibleName}}');
    expect(keys).toContain('{{responsibleRelationship}}');
  });

  // Story 157 — sem a entrada no catálogo o operador não descobre a variável de
  // foto: nem na barra lateral, nem no autocomplete, nem no drag-and-drop.
  it('inclui {{residentPhoto}} com rótulo e descrição próprios (story 157)', () => {
    const variable = VARIABLES.find((v) => v.key === '{{residentPhoto}}');
    expect(variable).toBeDefined();
    expect(variable!.label).toBe('Foto do acolhido');
    expect(variable!.description).toBe(
      'Foto do acolhido em 4×4 cm; moldura vazia com o rótulo "Foto" se não houver',
    );
  });

  // Story 159 — sem a entrada no catálogo a variável existe no backend mas é
  // invisível para quem edita o template.
  it('inclui {{exitDate}} logo depois de {{entryDate}} (story 159)', () => {
    const variable = VARIABLES.find((v) => v.key === '{{exitDate}}');
    expect(variable).toBeDefined();
    expect(variable!.label).toBe('Data de saída');
    expect(variable!.description).toBe(
      'Data de saída da comunidade (dd/mm/aaaa); "não informado" se o filho ainda está na casa',
    );

    // O par entrada/saída fica lado a lado na barra.
    const keys = VARIABLES.map((v) => v.key);
    expect(keys.indexOf('{{exitDate}}')).toBe(keys.indexOf('{{entryDate}}') + 1);
  });
});

// ─── RECEIPT_VARIABLES_BY_TYPE (story 193) ────────────────────────────────────
// Uma lista POR TIPO: o operador não pode receber a oferta de um token que o
// resolver daquele recibo não preenche.

describe('RECEIPT_VARIABLES_BY_TYPE', () => {
  const associate = RECEIPT_VARIABLES_BY_TYPE[ReceiptType.ASSOCIATE_CONTRIBUTION].map((v) => v.key);
  const resident = RECEIPT_VARIABLES_BY_TYPE[ReceiptType.RESIDENT_CONTRIBUTION].map((v) => v.key);

  it('o recibo do acolhido tem os tokens do filho e NÃO tem os do gateway', () => {
    expect(resident).toContain('{{residentName}}');
    expect(resident).toContain('{{payerRelationship}}');
    expect(resident).toContain('{{contributionPlan}}');
    expect(resident).toContain('{{paymentMethod}}');
    // Não há gateway no carnê do filho: imprimir taxa seria mentira formatada.
    expect(resident).not.toContain('{{netAmount}}');
    expect(resident).not.toContain('{{feeAmount}}');
  });

  // A lista da 178 não pode ter mudado: o recibo do associado é regressão.
  it('o recibo do associado permanece idêntico ao da story 178', () => {
    expect(associate).toEqual([
      '{{receiptNumber}}',
      '{{payerName}}',
      '{{payerCpf}}',
      '{{amount}}',
      '{{amountInWords}}',
      '{{netAmount}}',
      '{{feeAmount}}',
      '{{referenceMonth}}',
      '{{paymentDate}}',
      '{{dueDate}}',
      '{{date}}',
      '{{dateLong}}',
      '{{signature}}',
    ]);
    expect(associate).not.toContain('{{residentName}}');
  });

  it('nenhum recibo oferece token do documento do acolhido ({{name}}, {{residentPhoto}})', () => {
    for (const list of Object.values(RECEIPT_VARIABLES_BY_TYPE)) {
      const keys = list.map((v) => v.key);
      expect(keys).not.toContain('{{name}}');
      expect(keys).not.toContain('{{residentPhoto}}');
    }
  });

  it('todo tipo do enum tem lista (o Record completo quebra o build se faltar)', () => {
    for (const type of Object.values(ReceiptType)) {
      expect(RECEIPT_VARIABLES_BY_TYPE[type].length).toBeGreaterThan(0);
    }
  });
});

describe('receiptVariablesFor', () => {
  it('devolve a lista do tipo pedido', () => {
    expect(receiptVariablesFor(ReceiptType.RESIDENT_CONTRIBUTION).map((v) => v.key)).toContain(
      '{{residentName}}',
    );
  });

  it('tipo ausente/desconhecido cai no recibo do associado (o único que existia antes)', () => {
    expect(receiptVariablesFor(null)).toEqual(
      RECEIPT_VARIABLES_BY_TYPE[ReceiptType.ASSOCIATE_CONTRIBUTION],
    );
    expect(receiptVariablesFor(undefined)).toEqual(
      RECEIPT_VARIABLES_BY_TYPE[ReceiptType.ASSOCIATE_CONTRIBUTION],
    );
    expect(receiptVariablesFor('RIFA')).toEqual(
      RECEIPT_VARIABLES_BY_TYPE[ReceiptType.ASSOCIATE_CONTRIBUTION],
    );
  });
});

// ─── filterVariables ──────────────────────────────────────────────────────────
// Filtro puro do autocomplete inline (story 144): casa label + key,
// accent-insensitive e case-insensitive.

describe('filterVariables', () => {
  it('query vazia → lista completa', () => {
    expect(filterVariables('')).toEqual(VARIABLES);
    // Espaços em branco também contam como vazio (query.trim()).
    expect(filterVariables('   ')).toEqual(VARIABLES);
  });

  it('`naci` → só "Nacionalidade"', () => {
    const result = filterVariables('naci');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('{{nationality}}');
    expect(result[0].label).toBe('Nacionalidade');
  });

  it('`resp` → os 4 de Responsável', () => {
    const result = filterVariables('resp');
    expect(result.map((v) => v.key)).toEqual([
      '{{responsibleName}}',
      '{{responsibleRelationship}}',
      '{{responsibleWithRelationship}}',
      '{{responsiblePhone}}',
    ]);
  });

  // Story 153 — o token condicional novo entra na busca por "parentesco" junto
  // com o token simples; quem procura o parentesco vê as duas opções.
  it('`parentesco` → {{responsibleRelationship}} E {{responsibleWithRelationship}}', () => {
    const keys = filterVariables('parentesco').map((v) => v.key);
    expect(keys).toContain('{{responsibleRelationship}}');
    expect(keys).toContain('{{responsibleWithRelationship}}');
    expect(keys).toHaveLength(2);
  });

  it('accent-insensitive: `endereco` casa "Endereço"', () => {
    const keys = filterVariables('endereco').map((v) => v.key);
    expect(keys).toContain('{{address}}'); // label "Endereço"
  });

  it('case-insensitive: `NOME` casa "Nome completo"', () => {
    const keys = filterVariables('NOME').map((v) => v.key);
    expect(keys).toContain('{{name}}'); // label "Nome completo"
  });

  it('match por key: `houseCity` casa {{houseCity}}', () => {
    const result = filterVariables('houseCity');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('{{houseCity}}');
  });

  it('sem match → lista vazia', () => {
    expect(filterVariables('zzz_inexistente')).toEqual([]);
  });

  // Story 193 — o autocomplete filtra a lista DO TIPO do template aberto.
  it('com a lista do acolhido, `acolhido` casa os tokens do filho', () => {
    const source = RECEIPT_VARIABLES_BY_TYPE[ReceiptType.RESIDENT_CONTRIBUTION];
    const keys = filterVariables('acolhido', source).map((v) => v.key);
    expect(keys).toContain('{{residentName}}');
    expect(keys).toContain('{{residentCpf}}');
    // A lista do filho não tem tokens de gateway para casar.
    expect(filterVariables('taxa', source)).toEqual([]);
  });

  it('com a lista do associado, `taxa` casa {{feeAmount}} e nada do filho', () => {
    const source = RECEIPT_VARIABLES_BY_TYPE[ReceiptType.ASSOCIATE_CONTRIBUTION];
    expect(filterVariables('taxa', source).map((v) => v.key)).toEqual(['{{feeAmount}}']);
    expect(filterVariables('acolhido', source)).toEqual([]);
  });

  // Story 157 — quem procura pela palavra "foto" tem que achar a variável nova.
  it('`foto` → encontra {{residentPhoto}} (story 157)', () => {
    const keys = filterVariables('foto').map((v) => v.key);
    expect(keys).toContain('{{residentPhoto}}');
  });

  // Story 159 — quem digita a palavra encontra a variável com ou sem o acento, já
  // que o filtro passa pelo normalizeForSearch.
  it('`saída` e `saida` → ambos encontram {{exitDate}} (story 159)', () => {
    expect(filterVariables('saída').map((v) => v.key)).toContain('{{exitDate}}');
    expect(filterVariables('saida').map((v) => v.key)).toContain('{{exitDate}}');
  });

  it('match por key: `exitDate` casa só {{exitDate}} (story 159)', () => {
    const result = filterVariables('exitDate');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('{{exitDate}}');
  });
});

// ─── buildVariableInsertion ───────────────────────────────────────────────────
// Token a inserir no lugar do `{{parcial` digitado — exatamente um par `{{ }}`,
// nunca duplicado.

describe('buildVariableInsertion', () => {
  it('key já embrulhada → mesmo token, sem duplicar chaves', () => {
    expect(buildVariableInsertion('{{name}}')).toBe('{{name}}');
    expect(buildVariableInsertion('{{houseCity}}')).toBe('{{houseCity}}');
  });

  it('key nua → embrulha em um único par de chaves', () => {
    expect(buildVariableInsertion('name')).toBe('{{name}}');
  });

  // Story 153 — a key mais longa da lista continua saindo com EXATAMENTE um par
  // de chaves (o backend casa `\{\{responsibleWithRelationship\}\}` literal).
  it('responsibleWithRelationship → exatamente um par de chaves', () => {
    expect(buildVariableInsertion('responsibleWithRelationship')).toBe(
      '{{responsibleWithRelationship}}',
    );
    expect(buildVariableInsertion('{{responsibleWithRelationship}}')).toBe(
      '{{responsibleWithRelationship}}',
    );
  });

  // Story 157 — o backend casa `\{\{residentPhoto\}\}` literal: um par de chaves
  // a mais ou a menos deixaria o token cru no papel.
  it('residentPhoto → exatamente um par de chaves (story 157)', () => {
    expect(buildVariableInsertion('residentPhoto')).toBe('{{residentPhoto}}');
    expect(buildVariableInsertion('{{residentPhoto}}')).toBe('{{residentPhoto}}');
  });

  // Story 159 — idem para a saída: o backend casa `\{\{exitDate\}\}` literal.
  it('exitDate → exatamente um par de chaves (story 159)', () => {
    expect(buildVariableInsertion('exitDate')).toBe('{{exitDate}}');
    expect(buildVariableInsertion('{{exitDate}}')).toBe('{{exitDate}}');
  });

  it('nunca gera chaves aninhadas ({{{{name}} etc.)', () => {
    expect(buildVariableInsertion('{{{{name}}')).toBe('{{name}}');
    expect(buildVariableInsertion('{{name}}}}')).toBe('{{name}}');
    // O resultado sempre casa exatamente um par externo de chaves.
    for (const { key } of VARIABLES) {
      const token = buildVariableInsertion(key);
      expect(token).toMatch(/^\{\{[^{}]+\}\}$/);
    }
  });
});
