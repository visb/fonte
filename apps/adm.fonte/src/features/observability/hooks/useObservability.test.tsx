import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { observability: { stats: vi.fn(), reset: vi.fn(), health: vi.fn() } },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import { useObservabilityStats, useResetObservability } from './useObservability';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useObservabilityStats', () => {
  it('busca stats e guarda no cache sob queryKeys.observability.stats', async () => {
    const payload = {
      startedAt: '2026-08-30T12:00:00.000Z',
      runtime: {},
      routes: [],
      recent: [],
    };
    vi.mocked(api.observability.stats).mockResolvedValue(payload as never);

    const { result, queryClient } = renderHookWithClient(() => useObservabilityStats());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.observability.stats).toHaveBeenCalled();
    // Asserção da chave: query key literal fora do queryKeys.ts é a regra mais
    // violada do repo (CLAUDE.md).
    expect(queryClient.getQueryData(queryKeys.observability.stats)).toEqual(payload);
  });
});

describe('useResetObservability', () => {
  it('zera contadores e invalida observability.stats no sucesso', async () => {
    vi.mocked(api.observability.reset).mockResolvedValue({
      startedAt: '2026-08-30T12:30:00.000Z',
    } as never);

    const { result, queryClient } = renderHookWithClient(() => useResetObservability());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.observability.reset).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.observability.stats });
  });

  it('expõe o erro sem invalidar quando o reset falha', async () => {
    vi.mocked(api.observability.reset).mockRejectedValue(new Error('falhou'));

    const { result, queryClient } = renderHookWithClient(() => useResetObservability());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(spy).not.toHaveBeenCalled();
  });
});
