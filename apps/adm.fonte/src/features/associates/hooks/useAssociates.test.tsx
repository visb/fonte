import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

// Mocka o cliente HTTP compartilhado: nenhuma chamada real à API.
vi.mock('@/lib/api', () => ({
  api: {
    associates: {
      getOverview: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAssociatesOverview, useCreateAssociate } from './useAssociates';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useAssociatesOverview', () => {
  it('busca o overview usando a queryKey correta e retorna os dados', async () => {
    const overview = { totalActive: 3 };
    vi.mocked(api.associates.getOverview).mockResolvedValue(overview as never);

    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useAssociatesOverview(6), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.associates.getOverview).toHaveBeenCalledWith(6);
    expect(result.current.data).toEqual(overview);
    // Os dados ficam cacheados sob a queryKey esperada.
    expect(queryClient.getQueryData(queryKeys.associates.overview(6))).toEqual(overview);
  });
});

describe('useCreateAssociate', () => {
  it('cria o associado e invalida a lista no sucesso', async () => {
    vi.mocked(api.associates.create).mockResolvedValue({ id: 'a1' } as never);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateAssociate(), { wrapper });

    const input = {
      name: 'Maria',
      whatsapp: '+5562999998888',
      email: '',
      contributionAmount: 50,
      dueDay: 10,
    };
    result.current.mutate(input as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.associates.create).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.associates.all });
  });
});
