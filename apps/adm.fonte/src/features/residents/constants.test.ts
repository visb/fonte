import { describe, expect, it } from 'vitest';

import {
  importWarningFieldLabel,
  importWarningsSummary,
  warningsToList,
} from './constants';

describe('importWarningsSummary', () => {
  it('resume zero/um/vários alertas', () => {
    expect(importWarningsSummary(0)).toBe('Sem alertas');
    expect(importWarningsSummary(-1)).toBe('Sem alertas');
    expect(importWarningsSummary(1)).toBe('1 alerta');
    expect(importWarningsSummary(3)).toBe('3 alertas');
  });
});

describe('importWarningFieldLabel', () => {
  it('usa o rótulo mapeado quando existe', () => {
    expect(importWarningFieldLabel('entryDate')).toBe('Data de entrada');
    expect(importWarningFieldLabel('spreadsheet')).toBe('Planilha');
  });

  it('humaniza camelCase para chaves não mapeadas', () => {
    expect(importWarningFieldLabel('emergencyContact')).toBe('Emergency Contact');
  });

  it('humaniza underscore/hífen para chaves não mapeadas', () => {
    expect(importWarningFieldLabel('some_field-name')).toBe('Some field name');
  });
});

describe('warningsToList', () => {
  it('normaliza o record em lista com rótulo, descartando mensagens vazias', () => {
    expect(
      warningsToList({
        entryDate: 'ficha=X, planilha=Y',
        cpf: 'CPF ilegível',
        empty: '',
      }),
    ).toEqual([
      { key: 'entryDate', label: 'Data de entrada', message: 'ficha=X, planilha=Y' },
      { key: 'cpf', label: 'CPF', message: 'CPF ilegível' },
    ]);
  });

  it('retorna lista vazia quando não há warnings', () => {
    expect(warningsToList({})).toEqual([]);
  });
});
