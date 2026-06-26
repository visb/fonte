import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAssociatePublic, useSubscribe } from './useAssociatePublic';

const getByToken = vi.fn();
const subscribe = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    associates: {
      public: {
        getByToken: (token: string) => getByToken(token),
        subscribe: (token: string, data: unknown) => subscribe(token, data),
      },
    },
  },
}));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useAssociatePublic', () => {
  beforeEach(() => {
    getByToken.mockReset();
    subscribe.mockReset();
  });

  it('busca os dados públicos do associado por token', async () => {
    getByToken.mockResolvedValue({ name: 'Maria', contributionAmount: 5000 });

    const { result } = renderHook(() => useAssociatePublic('tok-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getByToken).toHaveBeenCalledWith('tok-1');
    expect(result.current.data?.name).toBe('Maria');
  });

  it('não busca quando o token é undefined (enabled=false)', () => {
    const { result } = renderHook(() => useAssociatePublic(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getByToken).not.toHaveBeenCalled();
  });
});

describe('useSubscribe', () => {
  beforeEach(() => {
    subscribe.mockReset();
  });

  it('envia a adesão com o token e o body', async () => {
    subscribe.mockResolvedValue({ subscriptionId: 'sub-1' });
    const { result } = renderHook(() => useSubscribe('tok-1'), { wrapper: wrapper() });

    const body = { cardToken: 'card-1' } as never;
    result.current.mutate(body);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(subscribe).toHaveBeenCalledWith('tok-1', body);
    expect(result.current.data?.subscriptionId).toBe('sub-1');
  });
});
