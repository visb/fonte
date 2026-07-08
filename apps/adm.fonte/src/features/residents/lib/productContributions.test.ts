import { describe, expect, it } from 'vitest';
import {
  emptyProductLine,
  productLineSchema,
  toContributionLines,
  type ProductLineForm,
} from './productContributions';

describe('emptyProductLine', () => {
  it('cria uma linha nova no modo catálogo', () => {
    expect(emptyProductLine()).toEqual({
      mode: 'catalog',
      inventoryItemId: '',
      description: '',
      quantity: '',
      unit: '',
    });
  });
});

describe('productLineSchema (item XOR descrição)', () => {
  it('catálogo válido: item + quantidade > 0', () => {
    const r = productLineSchema.safeParse({ mode: 'catalog', inventoryItemId: 's1', quantity: '2', unit: 'kg' });
    expect(r.success).toBe(true);
  });

  it('catálogo inválido: sem item e quantidade zero', () => {
    const r = productLineSchema.safeParse({ mode: 'catalog', inventoryItemId: '', quantity: '0' });
    expect(r.success).toBe(false);
  });

  it('catálogo inválido: quantidade não numérica', () => {
    const r = productLineSchema.safeParse({ mode: 'catalog', inventoryItemId: 's1', quantity: 'abc' });
    expect(r.success).toBe(false);
  });

  it('avulso válido: descrição preenchida', () => {
    const r = productLineSchema.safeParse({ mode: 'avulso', description: 'cesta' });
    expect(r.success).toBe(true);
  });

  it('avulso inválido: descrição em branco', () => {
    const r = productLineSchema.safeParse({ mode: 'avulso', description: '   ' });
    expect(r.success).toBe(false);
  });
});

describe('toContributionLines', () => {
  it('catálogo → item + quantity numérica + unit', () => {
    const lines: ProductLineForm[] = [{ mode: 'catalog', inventoryItemId: 's1', quantity: '3', unit: 'kg' }];
    expect(toContributionLines(lines)).toEqual([{ inventoryItemId: 's1', quantity: 3, unit: 'kg' }]);
  });

  it('catálogo sem unit → unit undefined', () => {
    const lines: ProductLineForm[] = [{ mode: 'catalog', inventoryItemId: 's1', quantity: '3', unit: '' }];
    expect(toContributionLines(lines)).toEqual([{ inventoryItemId: 's1', quantity: 3, unit: undefined }]);
  });

  it('avulso com quantidade e unidade opcionais preenchidas', () => {
    const lines: ProductLineForm[] = [{ mode: 'avulso', description: '  cesta  ', quantity: '2', unit: ' cx ' }];
    expect(toContributionLines(lines)).toEqual([{ description: 'cesta', quantity: 2, unit: 'cx' }]);
  });

  it('avulso sem quantidade/unidade → campos omitidos', () => {
    const lines: ProductLineForm[] = [{ mode: 'avulso', description: 'cesta', quantity: '', unit: '' }];
    expect(toContributionLines(lines)).toEqual([{ description: 'cesta', quantity: undefined, unit: undefined }]);
  });

  it('avulso com quantidade não numérica → quantity undefined', () => {
    const lines: ProductLineForm[] = [{ mode: 'avulso', description: 'cesta', quantity: 'x' }];
    expect(toContributionLines(lines)).toEqual([{ description: 'cesta', quantity: undefined, unit: undefined }]);
  });
});
