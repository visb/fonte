import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEventPaymentByToken, usePayEvent } from './useEventPayment';

const getByToken = vi.fn();
const pay = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    events: {
      payments: {
        getByToken: (token: string) => getByToken(token),
        pay: (token: string, data: unknown) => pay(token, data),
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

describe('useEventPayment (story 70)', () => {
  beforeEach(() => {
    getByToken.mockReset();
    pay.mockReset();
  });

  it('busca a inscrição por token', async () => {
    getByToken.mockResolvedValue({
      eventTitle: 'Retiro',
      amountCents: 5248,
      paymentStatus: 'PENDING',
      paymentMethod: null,
      registrantName: 'Maria',
    });

    const { result } = renderHook(() => useEventPaymentByToken('tok-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getByToken).toHaveBeenCalledWith('tok-1');
    expect(result.current.data?.amountCents).toBe(5248);
  });

  it('não busca sem token (enabled=false)', () => {
    const { result } = renderHook(() => useEventPaymentByToken(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getByToken).not.toHaveBeenCalled();
  });

  it('usePayEvent chama a API com o token e o body', async () => {
    pay.mockResolvedValue({ paymentStatus: 'PENDING', method: 'pix', pix: { qrCode: 'x' } });
    const { result } = renderHook(() => usePayEvent('tok-1'), { wrapper: wrapper() });

    result.current.mutate({ method: 'pix' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pay).toHaveBeenCalledWith('tok-1', { method: 'pix' });
  });
});
