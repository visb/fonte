import { describe, expect, it } from 'vitest';
import type { RegistrationField } from '@fonte/types';
import { buildRegistrationSchema, buildDefaultValues } from './registrationSchema';

function field(overrides: Partial<RegistrationField>): RegistrationField {
  return { id: 'f1', label: 'Campo', type: 'short_text', required: false, order: 0, ...overrides };
}

const base = { name: 'Maria', contact: '11999990000', email: '' };

describe('buildRegistrationSchema — base', () => {
  it('exige name e contact', () => {
    const schema = buildRegistrationSchema([]);
    expect(schema.safeParse({ name: '', contact: '', answers: {} }).success).toBe(false);
    expect(schema.safeParse({ ...base, answers: {} }).success).toBe(true);
  });
});

describe('buildRegistrationSchema — por tipo (story 68)', () => {
  it('short_text obrigatório rejeita vazio', () => {
    const schema = buildRegistrationSchema([field({ type: 'short_text', required: true })]);
    expect(schema.safeParse({ ...base, answers: { f1: '' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, answers: { f1: 'ok' } }).success).toBe(true);
  });

  it('number coage string numérica e rejeita texto', () => {
    const schema = buildRegistrationSchema([field({ type: 'number', required: true })]);
    const ok = schema.safeParse({ ...base, answers: { f1: '42' } });
    expect(ok.success).toBe(true);
    if (ok.success) expect((ok.data.answers as { f1: number }).f1).toBe(42);
    expect(schema.safeParse({ ...base, answers: { f1: 'abc' } }).success).toBe(false);
  });

  it('email valida formato', () => {
    const schema = buildRegistrationSchema([field({ type: 'email', required: true })]);
    expect(schema.safeParse({ ...base, answers: { f1: 'a@b.com' } }).success).toBe(true);
    expect(schema.safeParse({ ...base, answers: { f1: 'nope' } }).success).toBe(false);
  });

  it('phone valida formato básico', () => {
    const schema = buildRegistrationSchema([field({ type: 'phone', required: true })]);
    expect(schema.safeParse({ ...base, answers: { f1: '(11) 99999-0000' } }).success).toBe(true);
    expect(schema.safeParse({ ...base, answers: { f1: 'ab' } }).success).toBe(false);
  });

  it('date obrigatório rejeita vazio', () => {
    const schema = buildRegistrationSchema([field({ type: 'date', required: true })]);
    expect(schema.safeParse({ ...base, answers: { f1: '' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, answers: { f1: '2026-07-01' } }).success).toBe(true);
  });

  it('select obrigatório exige seleção', () => {
    const schema = buildRegistrationSchema([
      field({ type: 'select', required: true, options: ['P', 'M'] }),
    ]);
    expect(schema.safeParse({ ...base, answers: { f1: '' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, answers: { f1: 'M' } }).success).toBe(true);
  });

  it('multi_select obrigatório exige ao menos um', () => {
    const schema = buildRegistrationSchema([
      field({ type: 'multi_select', required: true, options: ['A', 'B'] }),
    ]);
    expect(schema.safeParse({ ...base, answers: { f1: [] } }).success).toBe(false);
    expect(schema.safeParse({ ...base, answers: { f1: ['A'] } }).success).toBe(true);
  });

  it('boolean é opcional com default false', () => {
    const schema = buildRegistrationSchema([field({ type: 'boolean', required: false })]);
    expect(schema.safeParse({ ...base, answers: {} }).success).toBe(true);
  });

  it('file obrigatório exige a key', () => {
    const schema = buildRegistrationSchema([field({ type: 'file', required: true })]);
    expect(schema.safeParse({ ...base, answers: { f1: '' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, answers: { f1: 'key/x.pdf' } }).success).toBe(true);
  });

  it('campos opcionais não preenchidos passam', () => {
    const schema = buildRegistrationSchema([
      field({ id: 'a', type: 'short_text', required: false }),
      field({ id: 'b', type: 'number', required: false }),
    ]);
    expect(schema.safeParse({ ...base, answers: { a: '', b: '' } }).success).toBe(true);
  });
});

describe('buildDefaultValues', () => {
  it('inicializa multi_select como [], boolean como false e demais como ""', () => {
    const dv = buildDefaultValues([
      field({ id: 'm', type: 'multi_select', options: ['A'] }),
      field({ id: 'b', type: 'boolean' }),
      field({ id: 't', type: 'short_text' }),
    ]);
    expect(dv.answers).toEqual({ m: [], b: false, t: '' });
  });
});
