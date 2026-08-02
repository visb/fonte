import { describe, expect, it } from 'vitest';
import {
  VARIABLES,
  buildVariableInsertion,
  filterVariables,
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
