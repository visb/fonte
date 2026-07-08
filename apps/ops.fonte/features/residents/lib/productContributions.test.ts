import {
  productLineSchema,
  productContributionFormSchema,
  emptyProductLine,
  toContributionLines,
  type ProductLineForm,
} from './productContributions';

describe('productLineSchema — validação item-XOR-descrição', () => {
  it('catálogo válido: item + quantidade > 0', () => {
    const r = productLineSchema.safeParse({
      mode: 'catalog',
      inventoryItemId: 'item-1',
      quantity: '3',
      unit: 'kg',
    });
    expect(r.success).toBe(true);
  });

  it('catálogo sem item acusa erro em inventoryItemId', () => {
    const r = productLineSchema.safeParse({ mode: 'catalog', inventoryItemId: '', quantity: '3' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('inventoryItemId'))).toBe(true);
    }
  });

  it('catálogo com quantidade zero/negativa/inválida acusa erro em quantity', () => {
    for (const quantity of ['0', '-1', '', 'abc']) {
      const r = productLineSchema.safeParse({ mode: 'catalog', inventoryItemId: 'x', quantity });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.some((i) => i.path.includes('quantity'))).toBe(true);
      }
    }
  });

  it('avulso válido só com descrição', () => {
    const r = productLineSchema.safeParse({ mode: 'avulso', description: 'cesta básica' });
    expect(r.success).toBe(true);
  });

  it('avulso sem descrição acusa erro em description', () => {
    const r = productLineSchema.safeParse({ mode: 'avulso', description: '   ' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('description'))).toBe(true);
    }
  });
});

describe('productContributionFormSchema', () => {
  it('exige ao menos uma linha', () => {
    expect(productContributionFormSchema.safeParse({ products: [] }).success).toBe(false);
  });

  it('aceita uma linha válida', () => {
    const r = productContributionFormSchema.safeParse({
      products: [{ mode: 'avulso', description: 'roupas' }],
    });
    expect(r.success).toBe(true);
  });
});

describe('emptyProductLine', () => {
  it('nasce no modo catálogo com campos em branco', () => {
    expect(emptyProductLine()).toEqual({
      mode: 'catalog',
      inventoryItemId: '',
      description: '',
      quantity: '',
      unit: '',
    });
  });
});

describe('toContributionLines — payload do backend', () => {
  it('linha de catálogo vira item + quantity numérica + unit', () => {
    const lines: ProductLineForm[] = [
      { mode: 'catalog', inventoryItemId: 'item-1', quantity: '5', unit: 'kg' },
    ];
    expect(toContributionLines(lines)).toEqual([
      { inventoryItemId: 'item-1', quantity: 5, unit: 'kg' },
    ]);
  });

  it('catálogo sem unit envia unit undefined', () => {
    const lines: ProductLineForm[] = [{ mode: 'catalog', inventoryItemId: 'i', quantity: '2', unit: '' }];
    expect(toContributionLines(lines)[0]).toEqual({ inventoryItemId: 'i', quantity: 2, unit: undefined });
  });

  it('avulso com quantidade/unidade preenchidas mapeia e faz trim', () => {
    const lines: ProductLineForm[] = [
      { mode: 'avulso', description: '  cesta  ', quantity: '2', unit: ' cx ' },
    ];
    expect(toContributionLines(lines)).toEqual([{ description: 'cesta', quantity: 2, unit: 'cx' }]);
  });

  it('avulso sem quantidade/unidade envia campos undefined', () => {
    const lines: ProductLineForm[] = [{ mode: 'avulso', description: 'roupas' }];
    expect(toContributionLines(lines)).toEqual([
      { description: 'roupas', quantity: undefined, unit: undefined },
    ]);
  });

  it('avulso com quantidade inválida descarta a quantidade', () => {
    const lines: ProductLineForm[] = [{ mode: 'avulso', description: 'x', quantity: 'abc' }];
    expect(toContributionLines(lines)[0]).toEqual({ description: 'x', quantity: undefined, unit: undefined });
  });
});
