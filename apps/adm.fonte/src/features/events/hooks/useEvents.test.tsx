import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    events: {
      list: vi.fn(),
      getById: vi.fn(),
      listRegistrations: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      uploadBanner: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useEvents,
  useEventById,
  useEventRegistrations,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useUploadEventBanner,
} from './useEvents';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('queries de eventos', () => {
  it('list usa a queryKey de filtro', async () => {
    vi.mocked(api.events.list).mockResolvedValue([] as never);
    const { result, queryClient } = renderHookWithClient(() => useEvents({ filter: 'upcoming' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.events.list).toHaveBeenCalledWith({ filter: 'upcoming' });
    expect(queryClient.getQueryData(queryKeys.events.list({ filter: 'upcoming' }))).toEqual([]);
  });

  it('getById e registrations respeitam enabled', async () => {
    const { result } = renderHookWithClient(() => useEventById('e1', { enabled: false }));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.events.listRegistrations).mockResolvedValue([] as never);
    const { result: r2 } = renderHookWithClient(() => useEventRegistrations('e1'));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.events.listRegistrations).toHaveBeenCalledWith('e1');
  });
});

describe('mutations de eventos', () => {
  it('create / update / delete', async () => {
    vi.mocked(api.events.create).mockResolvedValue({ id: 'e1' } as never);
    vi.mocked(api.events.update).mockResolvedValue({ id: 'e1' } as never);
    vi.mocked(api.events.remove).mockResolvedValue(undefined as never);

    const { result: c, queryClient } = renderHookWithClient(() => useCreateEvent());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ title: 'X' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.events.all });

    const { result: u } = renderHookWithClient(() => useUpdateEvent());
    u.current.mutate({ id: 'e1', data: { title: 'Y' } } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.events.update).toHaveBeenCalledWith('e1', { title: 'Y' });

    const { result: d } = renderHookWithClient(() => useDeleteEvent());
    d.current.mutate('e1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.events.remove).toHaveBeenCalledWith('e1');
  });

  it('uploadBanner monta FormData e invalida detalhe', async () => {
    vi.mocked(api.events.uploadBanner).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useUploadEventBanner());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ id: 'e1', file: new File(['x'], 'b.jpg') });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.events.uploadBanner).toHaveBeenCalledWith('e1', expect.any(FormData));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.events.detail('e1') });
  });
});
