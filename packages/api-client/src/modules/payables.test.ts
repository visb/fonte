import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPayablesModule } from './payables.js';

function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: undefined }),
    post: vi.fn().mockResolvedValue({ data: undefined }),
    patch: vi.fn().mockResolvedValue({ data: undefined }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  };
}

describe('payables module', () => {
  let http: ReturnType<typeof createHttpMock>;
  let payables: ReturnType<typeof createPayablesModule>;

  beforeEach(() => {
    http = createHttpMock();
    payables = createPayablesModule(http as unknown as AxiosInstance);
  });

  it('list repassa params no path certo', async () => {
    const params = { status: 'PENDING' } as never;
    await payables.list(params);
    expect(http.get).toHaveBeenCalledWith('/payables', { params });
  });

  it('summary repassa params no path de summary', async () => {
    const params = { month: '2026-06' } as never;
    await payables.summary(params);
    expect(http.get).toHaveBeenCalledWith('/payables/summary', { params });
  });

  it('getById monta a URL com o id', async () => {
    await payables.getById('pay-1');
    expect(http.get).toHaveBeenCalledWith('/payables/pay-1');
  });

  it('create envia o body por POST', async () => {
    const body = { description: 'Luz', amount: 100 } as never;
    await payables.create(body);
    expect(http.post).toHaveBeenCalledWith('/payables', body);
  });

  it('update monta URL com id e envia body por PATCH', async () => {
    const body = { amount: 120 } as never;
    await payables.update('pay-2', body);
    expect(http.patch).toHaveBeenCalledWith('/payables/pay-2', body);
  });

  it('pay envia objeto vazio quando body ausente', async () => {
    await payables.pay('pay-3');
    expect(http.patch).toHaveBeenCalledWith('/payables/pay-3/pay', {});
  });

  it('pay envia o body informado quando presente', async () => {
    const body = { paidAt: '2026-06-17' } as never;
    await payables.pay('pay-4', body);
    expect(http.patch).toHaveBeenCalledWith('/payables/pay-4/pay', body);
  });

  it('remove chama DELETE no path com id', async () => {
    await payables.remove('pay-5');
    expect(http.delete).toHaveBeenCalledWith('/payables/pay-5');
  });

  it('uploadAttachment envia FormData com Content-Type undefined', async () => {
    const fd = new FormData();
    await payables.uploadAttachment('pay-6', fd);
    expect(http.post).toHaveBeenCalledWith('/payables/pay-6/attachment', fd, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('removeAttachment chama DELETE no path de anexo', async () => {
    await payables.removeAttachment('pay-7');
    expect(http.delete).toHaveBeenCalledWith('/payables/pay-7/attachment');
  });

  it('propaga erro HTTP no shape que getErrorMessage espera', async () => {
    const httpError = { response: { status: 403, data: { message: 'Sem permissão' } } };
    http.get.mockRejectedValueOnce(httpError);

    await expect(payables.getById('x')).rejects.toMatchObject({
      response: { data: { message: 'Sem permissão' } },
    });
  });
});
