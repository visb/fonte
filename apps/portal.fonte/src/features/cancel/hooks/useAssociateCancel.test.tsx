import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAssociateCancelView, useCancelByToken } from './useAssociateCancel';

const getCancelView = vi.fn();
const cancelByToken = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    associates: {
      public: {
        getCancelView: (token: string) => getCancelView(token),
        cancelByToken: (token: string) => cancelByToken(token),
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

describe('useAssociateCancelView', () => {
  beforeEach(() => {
    getCancelView.mockReset();
    cancelByToken.mockReset();
  });

  it('busca a view de cancelamento por token', async () => {
    getCancelView.mockResolvedValue({ name: 'João', status: 'ACTIVE' });

    const { result } = renderHook(() => useAssociateCancelView('tok-9'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCancelView).toHaveBeenCalledWith('tok-9');
    expect(result.current.data?.status).toBe('ACTIVE');
  });

  it('não busca sem token (enabled=false)', () => {
    const { result } = renderHook(() => useAssociateCancelView(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getCancelView).not.toHaveBeenCalled();
  });
});

describe('useCancelByToken', () => {
  beforeEach(() => {
    cancelByToken.mockReset();
  });

  it('cancela a assinatura pelo token', async () => {
    cancelByToken.mockResolvedValue({ status: 'CANCELLED' });
    const { result } = renderHook(() => useCancelByToken('tok-9'), { wrapper: wrapper() });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelByToken).toHaveBeenCalledWith('tok-9');
    expect(result.current.data?.status).toBe('CANCELLED');
  });
});
