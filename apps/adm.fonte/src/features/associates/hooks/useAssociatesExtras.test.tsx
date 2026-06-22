import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    associates: {
      list: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      cancelSubscription: vi.fn(),
      getOverview: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useInfiniteAssociates,
  useAssociateById,
  useUpdateAssociate,
  useDeleteAssociate,
  useCancelAssociateSubscription,
} from './useAssociates';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useInfiniteAssociates', () => {
  it('pagina por offset usando total', async () => {
    vi.mocked(api.associates.list).mockResolvedValue({ data: [], total: 0 } as never);
    const { result } = renderHookWithClient(() => useInfiniteAssociates());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.associates.list).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('useAssociateById', () => {
  it('desliga sem id', () => {
    const { result } = renderHookWithClient(() => useAssociateById(null));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('busca com id', async () => {
    vi.mocked(api.associates.getById).mockResolvedValue({ id: 'a1' } as never);
    const { result } = renderHookWithClient(() => useAssociateById('a1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.associates.getById).toHaveBeenCalledWith('a1');
  });
});

describe('mutations de associado', () => {
  it('update invalida lista + detalhe', async () => {
    vi.mocked(api.associates.update).mockResolvedValue({ id: 'a1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdateAssociate());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ id: 'a1', data: { name: 'Edit' } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.associates.update).toHaveBeenCalledWith('a1', { name: 'Edit' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.associates.detail('a1') });
  });

  it('delete invalida lista', async () => {
    vi.mocked(api.associates.remove).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useDeleteAssociate());
    result.current.mutate('a1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.associates.remove).toHaveBeenCalledWith('a1');
  });

  it('cancelSubscription invalida lista + detalhe', async () => {
    vi.mocked(api.associates.cancelSubscription).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useCancelAssociateSubscription());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate('a1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.associates.cancelSubscription).toHaveBeenCalledWith('a1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.associates.detail('a1') });
  });
});
