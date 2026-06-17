import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAssociatesModule } from './associates.js';

/**
 * Transporte HTTP mockado: cada método do axios é um `vi.fn()` que resolve
 * `{ data }`. Asseguramos o contrato do cliente (método/url/params/body) sem
 * tocar a rede real.
 */
function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: undefined }),
    post: vi.fn().mockResolvedValue({ data: undefined }),
    patch: vi.fn().mockResolvedValue({ data: undefined }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  };
}

describe('associates module', () => {
  let http: ReturnType<typeof createHttpMock>;
  let associates: ReturnType<typeof createAssociatesModule>;

  beforeEach(() => {
    http = createHttpMock();
    associates = createAssociatesModule(http as unknown as AxiosInstance);
  });

  it('list repassa params e chama o path certo, retornando r.data', async () => {
    const page = { items: [], total: 0 };
    http.get.mockResolvedValueOnce({ data: page });

    const result = await associates.list({ limit: 20, offset: 40 });

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith('/associates', { params: { limit: 20, offset: 40 } });
    expect(result).toBe(page);
  });

  it('getOverview repassa months como param quando definido', async () => {
    await associates.getOverview(6);
    expect(http.get).toHaveBeenCalledWith('/associates/overview', { params: { months: 6 } });
  });

  it('getOverview passa params undefined quando months ausente', async () => {
    await associates.getOverview();
    expect(http.get).toHaveBeenCalledWith('/associates/overview', { params: undefined });
  });

  it('getById monta a URL com o id', async () => {
    await associates.getById('abc-123');
    expect(http.get).toHaveBeenCalledWith('/associates/abc-123');
  });

  it('create envia o body por POST no path certo', async () => {
    const body = { name: 'João', whatsapp: '11999999999', contributionAmount: 50, dueDay: 10 };
    await associates.create(body);
    expect(http.post).toHaveBeenCalledWith('/associates', body);
  });

  it('update monta a URL com id e envia o body por PATCH', async () => {
    const body = { name: 'Maria' };
    await associates.update('id-9', body);
    expect(http.patch).toHaveBeenCalledWith('/associates/id-9', body);
  });

  it('remove chama DELETE no path com id', async () => {
    await associates.remove('id-7');
    expect(http.delete).toHaveBeenCalledWith('/associates/id-7');
  });

  it('cancelSubscription chama o endpoint de cancelamento por POST', async () => {
    await associates.cancelSubscription('id-5');
    expect(http.post).toHaveBeenCalledWith('/associates/id-5/cancel-subscription');
  });

  describe('public (sem JWT, acesso por token)', () => {
    it('getByToken usa o path público com o token', async () => {
      await associates.public.getByToken('tok-1');
      expect(http.get).toHaveBeenCalledWith('/public/associates/tok-1');
    });

    it('subscribe envia o body por POST no path público', async () => {
      const body = { cardToken: 'card_xyz' } as never;
      await associates.public.subscribe('tok-2', body);
      expect(http.post).toHaveBeenCalledWith('/public/associates/tok-2/subscribe', body);
    });

    it('getCancelView usa o path público de cancel-view', async () => {
      await associates.public.getCancelView('tok-3');
      expect(http.get).toHaveBeenCalledWith('/public/associates/tok-3/cancel-view');
    });

    it('cancelByToken chama o cancelamento público por POST', async () => {
      await associates.public.cancelByToken('tok-4');
      expect(http.post).toHaveBeenCalledWith('/public/associates/tok-4/cancel');
    });
  });

  it('propaga erro HTTP no shape que getErrorMessage espera', async () => {
    const httpError = {
      response: { status: 400, data: { message: 'WhatsApp inválido' } },
    };
    http.post.mockRejectedValueOnce(httpError);

    await expect(
      associates.create({ name: 'x', whatsapp: 'bad', contributionAmount: 1, dueDay: 1 }),
    ).rejects.toMatchObject({ response: { data: { message: 'WhatsApp inválido' } } });
  });
});
