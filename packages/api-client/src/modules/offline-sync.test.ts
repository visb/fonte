import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOfflineSyncModule } from './offline-sync.js';

function createHttpMock() {
  return { get: vi.fn().mockResolvedValue({ data: {} }) };
}

describe('offline-sync module', () => {
  let http: ReturnType<typeof createHttpMock>;
  let offlineSync: ReturnType<typeof createOfflineSyncModule>;

  beforeEach(() => {
    http = createHttpMock();
    offlineSync = createOfflineSyncModule(http as unknown as AxiosInstance);
  });

  it('sem since pede o pacote completo, sem query nenhuma', async () => {
    await offlineSync.houseSnapshot('house-1');
    expect(http.get).toHaveBeenCalledWith('/houses/house-1/offline-snapshot', undefined);
  });

  it('com since manda o delta na query', async () => {
    await offlineSync.houseSnapshot('house-1', '2026-08-11T09:12:03.000Z');
    expect(http.get).toHaveBeenCalledWith('/houses/house-1/offline-snapshot', {
      params: { since: '2026-08-11T09:12:03.000Z' },
    });
  });

  it('devolve o envelope do snapshot', async () => {
    http.get.mockResolvedValueOnce({
      data: { syncedAt: '2026-08-14T12:00:00.000Z', full: true, residents: [] },
    });
    await expect(offlineSync.houseSnapshot('house-1')).resolves.toMatchObject({ full: true });
  });

  it('propaga erro HTTP no shape que getErrorMessage espera', async () => {
    http.get.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Forbidden' } } });
    await expect(offlineSync.houseSnapshot('house-1')).rejects.toMatchObject({
      response: { data: { message: 'Forbidden' } },
    });
  });
});
