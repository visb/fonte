import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SAMPLE_CARD = {
  number: '4111 1111 1111 1111',
  holderName: 'JOAO DA SILVA',
  expMonth: '12',
  expYear: '30',
  cvv: '123',
};

describe('cardTokenizer (DEV, sem VITE_PAGARME_PUBLIC_KEY)', () => {
  // No ambiente de teste a chave pública não está setada → modo stub.
  it('fica em modo stub', async () => {
    const { cardTokenizer } = await import('./cardTokenizer');
    expect(cardTokenizer.mode).toBe('stub');
  });

  it('devolve um token dev_tok_<last4>_<ts> sem chamar rede', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { cardTokenizer } = await import('./cardTokenizer');

    const token = await cardTokenizer.tokenize(SAMPLE_CARD);

    expect(token).toMatch(/^dev_tok_1111_\d+$/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('cardTokenizer (com chave pública, gateway indisponível)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_PAGARME_PUBLIC_KEY', 'pk_test_fake');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('fica em modo real quando há chave', async () => {
    const { cardTokenizer } = await import('./cardTokenizer');
    expect(cardTokenizer.mode).toBe('real');
  });

  it('lança erro amigável quando o gateway responde não-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false } as Response),
    );
    const { cardTokenizer } = await import('./cardTokenizer');

    await expect(cardTokenizer.tokenize(SAMPLE_CARD)).rejects.toThrow(
      /não foi possível validar o cartão/i,
    );
  });

  it('lança erro quando a resposta do gateway não traz id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response),
    );
    const { cardTokenizer } = await import('./cardTokenizer');

    await expect(cardTokenizer.tokenize(SAMPLE_CARD)).rejects.toThrow(
      /resposta inesperada/i,
    );
  });
});
