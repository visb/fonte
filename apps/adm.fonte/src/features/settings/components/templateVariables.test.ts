import { describe, expect, it } from 'vitest';
import {
  VARIABLES,
  buildVariableInsertion,
  filterVariables,
} from './templateVariables';

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

  it('`resp` → os 3 de Responsável', () => {
    const result = filterVariables('resp');
    expect(result.map((v) => v.key)).toEqual([
      '{{responsibleName}}',
      '{{responsibleRelationship}}',
      '{{responsiblePhone}}',
    ]);
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
