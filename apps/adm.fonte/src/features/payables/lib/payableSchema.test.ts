import { describe, expect, it } from 'vitest';
import { PayableCategory } from '@fonte/types';
import { payableSchema } from './payableSchema';

const valid = {
  description: 'Conta de luz',
  amount: 150.5,
  dueDate: '2026-06-10',
  category: PayableCategory.UTILITIES ?? Object.values(PayableCategory)[0],
};

describe('payableSchema', () => {
  it('aceita um lançamento válido', () => {
    expect(payableSchema.safeParse(valid).success).toBe(true);
  });

  it('exige descrição', () => {
    expect(payableSchema.safeParse({ ...valid, description: '' }).success).toBe(false);
  });

  it('exige valor positivo e coage string numérica', () => {
    expect(payableSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(payableSchema.safeParse({ ...valid, amount: -5 }).success).toBe(false);
    const parsed = payableSchema.parse({ ...valid, amount: '99.9' });
    expect(parsed.amount).toBeCloseTo(99.9);
  });

  it('rejeita valor não-numérico', () => {
    expect(payableSchema.safeParse({ ...valid, amount: 'abc' }).success).toBe(false);
  });

  it('exige vencimento e categoria válida', () => {
    expect(payableSchema.safeParse({ ...valid, dueDate: '' }).success).toBe(false);
    expect(payableSchema.safeParse({ ...valid, category: 'INVALID' }).success).toBe(false);
  });

  it('supplier e notes são opcionais', () => {
    const parsed = payableSchema.parse({ ...valid, supplier: 'CELG', notes: 'urgente' });
    expect(parsed.supplier).toBe('CELG');
    expect(parsed.notes).toBe('urgente');
  });
});
