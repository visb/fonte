import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePublicEvents, usePublicEventById, useRegisterToEvent } from './useEventsPublic';

const list = vi.fn();
const getById = vi.fn();
const register = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    events: {
      public: {
        list: () => list(),
        getById: (id: string) => getById(id),
        register: (id: string, data: unknown) => register(id, data),
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

describe('usePublicEvents', () => {
  beforeEach(() => {
    list.mockReset();
  });

  it('lista os eventos públicos', async () => {
    list.mockResolvedValue([{ id: 'e1', title: 'Retiro' }]);

    const { result } = renderHook(() => usePublicEvents(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([{ id: 'e1', title: 'Retiro' }]);
  });
});

describe('usePublicEventById', () => {
  beforeEach(() => {
    getById.mockReset();
  });

  it('busca o detalhe público por id', async () => {
    getById.mockResolvedValue({ id: 'e1', title: 'Retiro' });

    const { result } = renderHook(() => usePublicEventById('e1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getById).toHaveBeenCalledWith('e1');
    expect(result.current.data?.title).toBe('Retiro');
  });

  it('não busca sem id (enabled=false)', () => {
    const { result } = renderHook(() => usePublicEventById(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getById).not.toHaveBeenCalled();
  });
});

describe('useRegisterToEvent', () => {
  beforeEach(() => {
    register.mockReset();
  });

  it('inscreve no evento e invalida o detalhe no sucesso', async () => {
    register.mockResolvedValue({ registrationId: 'reg-1' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRegisterToEvent('e1'), { wrapper: localWrapper });

    const body = { name: 'Ana' } as never;
    result.current.mutate(body);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(register).toHaveBeenCalledWith('e1', body);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['events', 'public', 'e1'] });
  });
});
