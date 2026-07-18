import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PreferenceKeyParam } from './preference-key.param';
import {
  SetPreferenceDto,
  PreferenceValueSizeConstraint,
  PREFERENCE_VALUE_MAX_BYTES,
} from './set-preference.dto';

function validateKey(key: string): boolean {
  const dto = plainToInstance(PreferenceKeyParam, { key });
  return validateSync(dto).length === 0;
}

describe('PreferenceKeyParam', () => {
  it.each(['residents.filters', 'dashboard.range', 'a', 'x'.padEnd(64, 'y')])(
    'aceita a chave válida %s',
    (key) => {
      expect(validateKey(key)).toBe(true);
    },
  );

  it.each([
    '../../etc',
    'Residents.filters',
    '1residents',
    'residents filters',
    'residents/filters',
    '.leading',
    'x'.padEnd(65, 'y'),
    '',
  ])('rejeita a chave inválida %s', (key) => {
    expect(validateKey(key)).toBe(false);
  });
});

describe('SetPreferenceDto', () => {
  function validateValue(value: unknown): boolean {
    const dto = plainToInstance(SetPreferenceDto, { value });
    return validateSync(dto).length === 0;
  }

  it('aceita JSON pequeno', () => {
    expect(validateValue({ status: 'ACTIVE', house: 'h1' })).toBe(true);
  });

  it('aceita value falsy definido (string vazia, 0, false)', () => {
    expect(validateValue('')).toBe(true);
    expect(validateValue(0)).toBe(true);
    expect(validateValue(false)).toBe(true);
  });

  it('rejeita value ausente — undefined ou null (@IsDefined)', () => {
    expect(validateSync(plainToInstance(SetPreferenceDto, {})).length).toBeGreaterThan(0);
    expect(validateValue(null)).toBe(false);
  });

  it('rejeita value acima de 4 KB', () => {
    const big = { blob: 'x'.repeat(PREFERENCE_VALUE_MAX_BYTES + 1) };
    expect(validateValue(big)).toBe(false);
  });
});

describe('PreferenceValueSizeConstraint', () => {
  const constraint = new PreferenceValueSizeConstraint();

  it('mede em bytes UTF-8 (multibyte conta mais)', () => {
    // Cada emoji ocupa 4 bytes; ultrapassa o teto mesmo com menos "chars".
    const value = '😀'.repeat(PREFERENCE_VALUE_MAX_BYTES / 4);
    expect(constraint.validate(value)).toBe(false);
  });

  it('rejeita valor não serializável (ciclo)', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(constraint.validate(cyclic)).toBe(false);
  });

  it('tem mensagem padrão citando o limite', () => {
    expect(constraint.defaultMessage()).toContain(String(PREFERENCE_VALUE_MAX_BYTES));
  });
});
