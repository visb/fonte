import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBRL, previewGrossUp } from './money';

describe('formatBRL', () => {
  it('formata em reais (pt-BR)', () => {
    //   = espaço não-quebrável usado pelo Intl no separador R$.
    expect(formatBRL(100)).toBe('R$ 100,00');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50');
  });
});

describe('previewGrossUp (sem taxas configuradas)', () => {
  // No ambiente de teste VITE_PAGARME_CARD_FEE_* não está setado → fee = 0,
  // então o bruto é igual ao líquido.
  it('retorna gross == net e fee 0 quando não há taxa', () => {
    expect(previewGrossUp(100)).toEqual({ net: 100, fee: 0, gross: 100 });
  });

  it('trata valores inválidos/negativos como 0', () => {
    expect(previewGrossUp(0)).toEqual({ net: 0, fee: 0, gross: 0 });
    expect(previewGrossUp(-50)).toEqual({ net: 0, fee: 0, gross: 0 });
    expect(previewGrossUp(NaN)).toEqual({ net: 0, fee: 0, gross: 0 });
  });
});

describe('previewGrossUp (com taxas Pagar.me)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('aplica a fórmula gross = round2((net + fixed) / (1 - pct))', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_PAGARME_CARD_FEE_PCT', '0.0399');
    vi.stubEnv('VITE_PAGARME_CARD_FEE_FIXED', '0.39');
    // Reimporta para reavaliar as constantes a partir do env stubado.
    const { previewGrossUp: previewWithFee } = await import('./money');

    const result = previewWithFee(100);
    // gross = round2((100 + 0.39) / (1 - 0.0399)) = round2(104.5615...) = 104.56
    expect(result.net).toBe(100);
    expect(result.gross).toBe(104.56);
    expect(result.fee).toBe(4.56);
    // contribuição + taxa == cobrado (fórmula da story 38/41).
    expect(Math.round((result.net + result.fee) * 100) / 100).toBe(result.gross);
  });

  it('degrada para sem taxa quando pct >= 1', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_PAGARME_CARD_FEE_PCT', '1');
    vi.stubEnv('VITE_PAGARME_CARD_FEE_FIXED', '0.39');
    const { previewGrossUp: previewWithFee } = await import('./money');

    expect(previewWithFee(100)).toEqual({ net: 100, fee: 0, gross: 100 });
  });
});
