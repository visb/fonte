import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    census: {
      listPending: vi.fn(),
      approveAll: vi.fn(),
      reject: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useCensusPending,
  useApproveAllCensus,
  useRejectCensusResident,
} from './useCensus';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('censo', () => {
  it('pending desliga sem houseId', () => {
    const { result } = renderHookWithClient(() => useCensusPending(''));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('pending busca por casa', async () => {
    vi.mocked(api.census.listPending).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useCensusPending('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.census.listPending).toHaveBeenCalledWith('h1');
  });

  it('approveAll invalida pending, notificações, residentes e casas', async () => {
    vi.mocked(api.census.approveAll).mockResolvedValue(undefined as never);
    const { result, queryClient } = renderHookWithClient(() => useApproveAllCensus('h1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.census.approveAll).toHaveBeenCalledWith('h1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.census.pending('h1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.notifications.all });
  });

  it('reject chama a API com o residentId', async () => {
    vi.mocked(api.census.reject).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useRejectCensusResident('h1'));
    result.current.mutate('r1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.census.reject).toHaveBeenCalledWith('r1');
  });
});
