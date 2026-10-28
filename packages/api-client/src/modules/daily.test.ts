import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDailyModule } from './daily.js';

function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: { session: { id: 's1' } } }),
    post: vi.fn().mockResolvedValue({ data: { version: 2 } }),
  };
}

describe('daily module (story 225)', () => {
  let http: ReturnType<typeof createHttpMock>;
  let daily: ReturnType<typeof createDailyModule>;

  beforeEach(() => {
    http = createHttpMock();
    daily = createDailyModule(http as unknown as AxiosInstance);
  });

  it('current busca /daily/current com houseId quando informado', async () => {
    await expect(daily.current('h1')).resolves.toEqual({ session: { id: 's1' } });
    expect(http.get).toHaveBeenCalledWith('/daily/current', { params: { houseId: 'h1' } });
    await daily.current();
    expect(http.get).toHaveBeenLastCalledWith('/daily/current', { params: undefined });
  });

  it('move faz POST do movimento na sessão', async () => {
    const input = { personType: 'RESIDENT' as never, personId: 'r1', toMinistryId: null };
    await expect(daily.move('s1', input)).resolves.toEqual({ version: 2 });
    expect(http.post).toHaveBeenCalledWith('/daily-sessions/s1/moves', input);
  });

  it('apply faz POST em /apply', async () => {
    http.post.mockResolvedValueOnce({ data: { applied: 3, skipped: [] } });
    await expect(daily.apply('s1')).resolves.toEqual({ applied: 3, skipped: [] });
    expect(http.post).toHaveBeenCalledWith('/daily-sessions/s1/apply');
  });

  it('start faz POST em /daily (com ou sem casa)', async () => {
    await daily.start('h1');
    expect(http.post).toHaveBeenCalledWith('/daily', { houseId: 'h1' });
    await daily.start();
    expect(http.post).toHaveBeenLastCalledWith('/daily', {});
  });

  it('propaga erro HTTP no shape que getErrorMessage espera', async () => {
    http.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Esta daily já foi encerrada.' } } });
    await expect(daily.apply('s1')).rejects.toMatchObject({ response: { status: 409 } });
  });
});
