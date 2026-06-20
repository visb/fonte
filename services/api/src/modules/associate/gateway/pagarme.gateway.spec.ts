import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpPagarmeGateway } from './pagarme.gateway';

/**
 * Unit test do `createOrder` (cobrança avulsa de evento, story 69). `fetch` é
 * MOCKADO — a API real da Pagar.me nunca é chamada (sem secret key). Cobre o
 * mapeamento de cartão e PIX e a falha sem chave configurada.
 */
function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: (key: string) => overrides[key],
  } as unknown as ConfigService;
}

describe('HttpPagarmeGateway.createOrder', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('cartão: monta payments[].credit_card.card_token e devolve ids', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'or_1',
        status: 'pending',
        charges: [{ id: 'ch_1', status: 'pending' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const gateway = new HttpPagarmeGateway(
      makeConfig({ PAGARME_SECRET_KEY: 'sk_test', PAGARME_BASE_URL: 'https://api.pagar.me/core/v5' }),
    );

    const result = await gateway.createOrder({
      grossAmount: 52.48,
      method: 'credit_card',
      cardToken: 'card_tok',
      itemName: 'Inscrição — Retiro',
      externalId: 'reg-1',
    });

    expect(result).toEqual({
      orderId: 'or_1',
      chargeId: 'ch_1',
      status: 'pending',
      pixQrCode: null,
      pixQrCodeUrl: null,
      pixExpiresAt: null,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.pagar.me/core/v5/orders');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.payments[0].payment_method).toBe('credit_card');
    expect(body.payments[0].credit_card.card_token).toBe('card_tok');
    expect(body.items[0].amount).toBe(5248);
  });

  it('PIX: monta payments[].pix e devolve qr_code/qr_code_url', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'or_2',
        charges: [
          {
            id: 'ch_2',
            status: 'pending',
            last_transaction: {
              qr_code: '00020126PIX',
              qr_code_url: 'https://qr/img.png',
              expires_at: '2026-06-01T13:00:00Z',
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const gateway = new HttpPagarmeGateway(makeConfig({ PAGARME_SECRET_KEY: 'sk_test' }));

    const result = await gateway.createOrder({
      grossAmount: 30,
      method: 'pix',
      itemName: 'Inscrição',
      externalId: 'reg-2',
    });

    expect(result.pixQrCode).toBe('00020126PIX');
    expect(result.pixQrCodeUrl).toBe('https://qr/img.png');
    expect(result.pixExpiresAt).toBe('2026-06-01T13:00:00Z');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.payments[0].payment_method).toBe('pix');
  });

  it('sem secret key → ServiceUnavailable (não chama o fetch)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const gateway = new HttpPagarmeGateway(makeConfig({}));

    await expect(
      gateway.createOrder({
        grossAmount: 10,
        method: 'pix',
        itemName: 'x',
        externalId: 'reg-3',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
