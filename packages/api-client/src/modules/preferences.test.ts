import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPreferencesModule } from './preferences.js';

function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: undefined }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  };
}

describe('preferences module', () => {
  let http: ReturnType<typeof createHttpMock>;
  let preferences: ReturnType<typeof createPreferencesModule>;

  beforeEach(() => {
    http = createHttpMock();
    preferences = createPreferencesModule(http as unknown as AxiosInstance);
  });

  it('getAll busca o mapa em /preferences', async () => {
    http.get.mockResolvedValueOnce({ data: { 'residents.filters': { status: '' } } });
    await expect(preferences.getAll()).resolves.toEqual({
      'residents.filters': { status: '' },
    });
    expect(http.get).toHaveBeenCalledWith('/preferences');
  });

  it('set faz PUT na chave com o value no envelope { value }', async () => {
    await preferences.set('residents.filters', { status: 'ACTIVE' });
    expect(http.put).toHaveBeenCalledWith('/preferences/residents.filters', {
      value: { status: 'ACTIVE' },
    });
  });

  it('remove chama DELETE no path da chave', async () => {
    await preferences.remove('residents.filters');
    expect(http.delete).toHaveBeenCalledWith('/preferences/residents.filters');
  });

  it('propaga erro HTTP no shape que getErrorMessage espera', async () => {
    const httpError = { response: { status: 401, data: { message: 'Não autorizado' } } };
    http.get.mockRejectedValueOnce(httpError);
    await expect(preferences.getAll()).rejects.toMatchObject({
      response: { data: { message: 'Não autorizado' } },
    });
  });
});
