import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResidentsModule } from './residents.js';

function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: undefined }),
    post: vi.fn().mockResolvedValue({ data: undefined }),
    patch: vi.fn().mockResolvedValue({ data: undefined }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  };
}

describe('residents module', () => {
  let http: ReturnType<typeof createHttpMock>;
  let residents: ReturnType<typeof createResidentsModule>;

  beforeEach(() => {
    http = createHttpMock();
    residents = createResidentsModule(http as unknown as AxiosInstance);
  });

  it('list repassa params e retorna r.data', async () => {
    const paged = { data: [], total: 0, page: 1, limit: 10 };
    http.get.mockResolvedValueOnce({ data: paged });

    const result = await residents.list({ page: 2, limit: 10, search: 'ana' });

    expect(http.get).toHaveBeenCalledWith('/residents', {
      params: { page: 2, limit: 10, search: 'ana' },
    });
    expect(result).toBe(paged);
  });

  it('listByHouse monta a URL aninhada por casa', async () => {
    await residents.listByHouse('house-1');
    expect(http.get).toHaveBeenCalledWith('/houses/house-1/residents');
  });

  it('getById monta a URL com o id', async () => {
    await residents.getById('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1');
  });

  it('create envia o body por POST', async () => {
    const body = { name: 'Pedro', houseId: 'h1' };
    await residents.create(body);
    expect(http.post).toHaveBeenCalledWith('/residents', body);
  });

  it('update monta URL com id e envia body por PATCH', async () => {
    const body = { name: 'Pedro Silva' };
    await residents.update('res-2', body);
    expect(http.patch).toHaveBeenCalledWith('/residents/res-2', body);
  });

  it('delete chama DELETE no path com id', async () => {
    await residents.delete('res-3');
    expect(http.delete).toHaveBeenCalledWith('/residents/res-3');
  });

  it('uploadPhoto envia FormData com Content-Type undefined', async () => {
    const form = new FormData();
    await residents.uploadPhoto('res-4', form);
    expect(http.post).toHaveBeenCalledWith('/residents/res-4/photo', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('contributionsReport repassa params no path de relatório', async () => {
    const params = { month: '2026-06' } as never;
    await residents.contributionsReport(params);
    expect(http.get).toHaveBeenCalledWith('/residents/contributions/report', { params });
  });

  it('setContributionExempt envia o flag no body', async () => {
    await residents.setContributionExempt('res-5', true);
    expect(http.patch).toHaveBeenCalledWith('/residents/res-5/contribution-exempt', {
      exempt: true,
    });
  });

  it('propaga erro HTTP no shape que getErrorMessage espera (message array)', async () => {
    const httpError = {
      response: { status: 422, data: { message: ['houseId é obrigatório'] } },
    };
    http.post.mockRejectedValueOnce(httpError);

    await expect(residents.create({ name: 'x', houseId: '' })).rejects.toMatchObject({
      response: { data: { message: ['houseId é obrigatório'] } },
    });
  });
});
