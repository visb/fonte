import { BadRequestException } from '@nestjs/common';
import { RegistrationField } from '@fonte/types';
import {
  normalizeRegistrationFields,
  validateAndPickAnswers,
} from './registration-fields.util';

// ─── normalizeRegistrationFields ────────────────────────────────────────────────

describe('normalizeRegistrationFields', () => {
  it('returns [] for undefined/empty input', () => {
    expect(normalizeRegistrationFields(undefined)).toEqual([]);
    expect(normalizeRegistrationFields([])).toEqual([]);
  });

  it('generates a stable id for fields without one', () => {
    const out = normalizeRegistrationFields([
      { label: 'Camiseta', type: 'short_text', required: false, order: 0 },
    ]);
    expect(out).toHaveLength(1);
    expect(typeof out[0].id).toBe('string');
    expect(out[0].id.length).toBeGreaterThan(0);
  });

  it('keeps an explicit id', () => {
    const out = normalizeRegistrationFields([
      { id: 'shirt', label: 'Camiseta', type: 'short_text', required: false, order: 0 },
    ]);
    expect(out[0].id).toBe('shirt');
  });

  it('rejects duplicate ids (400)', () => {
    expect(() =>
      normalizeRegistrationFields([
        { id: 'x', label: 'A', type: 'short_text', required: false, order: 0 },
        { id: 'x', label: 'B', type: 'short_text', required: false, order: 1 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('reindexes order by declared position', () => {
    const out = normalizeRegistrationFields([
      { id: 'a', label: 'A', type: 'short_text', required: false, order: 9 },
      { id: 'b', label: 'B', type: 'short_text', required: false, order: 3 },
    ]);
    expect(out.map((f) => f.order)).toEqual([0, 1]);
  });

  it('preserves options for select/multi_select', () => {
    const out = normalizeRegistrationFields([
      { id: 's', label: 'Tamanho', type: 'select', required: true, order: 0, options: ['P', 'M', 'G'] },
    ]);
    expect(out[0].options).toEqual(['P', 'M', 'G']);
  });

  it('drops options for non-option types', () => {
    const out = normalizeRegistrationFields([
      // options não deveria existir aqui; normalize não a propaga.
      { id: 't', label: 'Nome', type: 'short_text', required: false, order: 0, options: ['x'] },
    ]);
    expect(out[0].options).toBeUndefined();
  });
});

// ─── validateAndPickAnswers ─────────────────────────────────────────────────────

function field(overrides: Partial<RegistrationField>): RegistrationField {
  return {
    id: 'f1',
    label: 'Campo',
    type: 'short_text',
    required: false,
    order: 0,
    ...overrides,
  };
}

describe('validateAndPickAnswers — required & unknown keys', () => {
  it('throws 400 when a required field is missing', () => {
    const fields = [field({ id: 'f1', required: true })];
    expect(() => validateAndPickAnswers(fields, {})).toThrow(BadRequestException);
  });

  it('throws 400 when required value is empty string', () => {
    const fields = [field({ id: 'f1', required: true })];
    expect(() => validateAndPickAnswers(fields, { f1: '' })).toThrow(BadRequestException);
  });

  it('skips optional missing fields', () => {
    const fields = [field({ id: 'f1', required: false })];
    expect(validateAndPickAnswers(fields, {})).toEqual({});
  });

  it('persists only known fieldIds (ignores stray keys)', () => {
    const fields = [field({ id: 'f1', type: 'short_text' })];
    const out = validateAndPickAnswers(fields, { f1: 'ok', bogus: 'nope' });
    expect(out).toEqual({ f1: 'ok' });
  });
});

describe('validateAndPickAnswers — per type', () => {
  it('short_text/long_text accept strings, reject non-strings', () => {
    expect(validateAndPickAnswers([field({ type: 'long_text' })], { f1: 'oi' })).toEqual({ f1: 'oi' });
    expect(() => validateAndPickAnswers([field({ type: 'short_text' })], { f1: 5 })).toThrow(
      BadRequestException,
    );
  });

  it('number coerces numeric strings, rejects non-numeric & booleans', () => {
    expect(validateAndPickAnswers([field({ type: 'number' })], { f1: '42' })).toEqual({ f1: 42 });
    expect(validateAndPickAnswers([field({ type: 'number' })], { f1: 7 })).toEqual({ f1: 7 });
    expect(() => validateAndPickAnswers([field({ type: 'number' })], { f1: 'abc' })).toThrow(
      BadRequestException,
    );
    expect(() => validateAndPickAnswers([field({ type: 'number' })], { f1: true })).toThrow(
      BadRequestException,
    );
  });

  it('boolean accepts bool and "true"/"false"', () => {
    expect(validateAndPickAnswers([field({ type: 'boolean' })], { f1: true })).toEqual({ f1: true });
    expect(validateAndPickAnswers([field({ type: 'boolean' })], { f1: 'false' })).toEqual({
      f1: false,
    });
    expect(() => validateAndPickAnswers([field({ type: 'boolean' })], { f1: 'maybe' })).toThrow(
      BadRequestException,
    );
  });

  it('date accepts ISO, rejects garbage', () => {
    expect(validateAndPickAnswers([field({ type: 'date' })], { f1: '2026-07-01' })).toEqual({
      f1: '2026-07-01',
    });
    expect(() => validateAndPickAnswers([field({ type: 'date' })], { f1: '01/07/2026' })).toThrow(
      BadRequestException,
    );
  });

  it('email validates format', () => {
    expect(validateAndPickAnswers([field({ type: 'email' })], { f1: 'a@b.com' })).toEqual({
      f1: 'a@b.com',
    });
    expect(() => validateAndPickAnswers([field({ type: 'email' })], { f1: 'nope' })).toThrow(
      BadRequestException,
    );
  });

  it('phone validates a basic format', () => {
    expect(validateAndPickAnswers([field({ type: 'phone' })], { f1: '(11) 99999-0000' })).toEqual({
      f1: '(11) 99999-0000',
    });
    expect(() => validateAndPickAnswers([field({ type: 'phone' })], { f1: 'ab' })).toThrow(
      BadRequestException,
    );
  });

  it('select must be within options', () => {
    const fields = [field({ type: 'select', options: ['P', 'M'] })];
    expect(validateAndPickAnswers(fields, { f1: 'M' })).toEqual({ f1: 'M' });
    expect(() => validateAndPickAnswers(fields, { f1: 'X' })).toThrow(BadRequestException);
  });

  it('multi_select must be a subset of options', () => {
    const fields = [field({ type: 'multi_select', options: ['A', 'B', 'C'] })];
    expect(validateAndPickAnswers(fields, { f1: ['A', 'C'] })).toEqual({ f1: ['A', 'C'] });
    expect(() => validateAndPickAnswers(fields, { f1: ['A', 'Z'] })).toThrow(BadRequestException);
    expect(() => validateAndPickAnswers(fields, { f1: 'A' })).toThrow(BadRequestException);
  });

  it('file stores the raw key string', () => {
    expect(validateAndPickAnswers([field({ type: 'file' })], { f1: 'event-registrations/x.pdf' })).toEqual({
      f1: 'event-registrations/x.pdf',
    });
    expect(() => validateAndPickAnswers([field({ type: 'file' })], { f1: 123 })).toThrow(
      BadRequestException,
    );
  });
});
