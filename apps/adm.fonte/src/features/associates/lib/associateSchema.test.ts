import { describe, expect, it } from 'vitest';
import { associateSchema } from './associateSchema';

const valid = {
  name: 'João da Silva',
  whatsapp: '+5562999998888',
  email: 'joao@example.com',
  contributionAmount: 50,
  dueDay: 10,
};

describe('associateSchema', () => {
  it('aceita um associado válido', () => {
    const result = associateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('aceita email vazio (opcional)', () => {
    const result = associateSchema.safeParse({ ...valid, email: '' });
    expect(result.success).toBe(true);
  });

  it('coage strings numéricas em number', () => {
    const result = associateSchema.safeParse({
      ...valid,
      contributionAmount: '75',
      dueDay: '5',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contributionAmount).toBe(75);
      expect(result.data.dueDay).toBe(5);
    }
  });

  it('rejeita nome vazio', () => {
    const result = associateSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejeita whatsapp fora do formato E.164', () => {
    const result = associateSchema.safeParse({ ...valid, whatsapp: '62999998888' });
    expect(result.success).toBe(false);
  });

  it('rejeita contribuição não-positiva', () => {
    const result = associateSchema.safeParse({ ...valid, contributionAmount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejeita dia de vencimento fora de 1–31', () => {
    expect(associateSchema.safeParse({ ...valid, dueDay: 0 }).success).toBe(false);
    expect(associateSchema.safeParse({ ...valid, dueDay: 32 }).success).toBe(false);
  });
});
