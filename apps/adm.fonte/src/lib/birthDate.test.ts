import { describe, expect, it } from 'vitest';
import { maxBirthDateFor, MIN_AGE_MESSAGE, todayInSaoPaulo } from '@fonte/types';
import { birthDateError, birthDateField, maxBirthDate } from './birthDate';

const TODAY = '2026-10-16';

describe('birthDateError (story 202)', () => {
  it('vazio, nulo ou indefinido passa (campo opcional)', () => {
    expect(birthDateError('', undefined, TODAY)).toBeNull();
    expect(birthDateError(null, undefined, TODAY)).toBeNull();
    expect(birthDateError(undefined, '2015-01-01', TODAY)).toBeNull();
  });

  it('menor de 18 → mensagem única; 18 anos hoje → ok; adulto → ok', () => {
    expect(birthDateError('2008-10-17', undefined, TODAY)).toBe(MIN_AGE_MESSAGE);
    expect(birthDateError('2008-10-16', undefined, TODAY)).toBeNull();
    expect(birthDateError('1970-01-01', null, TODAY)).toBeNull();
  });

  it('edição: data igual à carregada passa mesmo sendo de menor', () => {
    expect(birthDateError('2015-01-01', '2015-01-01T00:00:00.000Z', TODAY)).toBeNull();
  });

  it('edição: data alterada para menor é recusada', () => {
    expect(birthDateError('2015-01-01', '1980-01-01', TODAY)).toBe(MIN_AGE_MESSAGE);
  });

  it('sem `today` usa a data de São Paulo', () => {
    expect(birthDateError('2999-01-01')).toBe(MIN_AGE_MESSAGE);
    expect(birthDateError('1950-01-01')).toBeNull();
  });
});

describe('maxBirthDate', () => {
  it('é hoje − 18 anos', () => {
    expect(maxBirthDate(TODAY)).toBe('2008-10-16');
    expect(maxBirthDate()).toBe(maxBirthDateFor(todayInSaoPaulo()));
  });
});

describe('birthDateField', () => {
  it('criação: menor reprova com a mensagem, adulto e vazio passam', () => {
    const field = birthDateField();
    const minor = `${Number(todayInSaoPaulo().slice(0, 4)) - 10}-01-01`;
    const res = field.safeParse(minor);
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].message).toBe(MIN_AGE_MESSAGE);
    expect(field.safeParse('1980-01-01').success).toBe(true);
    expect(field.safeParse('').success).toBe(true);
    expect(field.safeParse(undefined).success).toBe(true);
  });

  it('edição: valor carregado de menor e não alterado passa', () => {
    const legacy = `${Number(todayInSaoPaulo().slice(0, 4)) - 10}-01-01`;
    expect(birthDateField(legacy).safeParse(legacy).success).toBe(true);
  });
});
