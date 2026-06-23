import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    messages: {
      getConversations: vi.fn(),
      getDirectConversations: vi.fn(),
      getThread: vi.fn(),
      getDirectThread: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useConversations,
  useDirectConversations,
  useThread,
  useDirectThread,
  useApproveMessage,
  useRejectMessage,
} from './useMessages';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('conversas', () => {
  it('lista conversas e conversas diretas', async () => {
    vi.mocked(api.messages.getConversations).mockResolvedValue([] as never);
    vi.mocked(api.messages.getDirectConversations).mockResolvedValue([] as never);

    const { result } = renderHookWithClient(() => useConversations());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.messages.getConversations).toHaveBeenCalled();

    const { result: d } = renderHookWithClient(() => useDirectConversations());
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
  });

  it('thread desliga sem ambos os ids', () => {
    const { result } = renderHookWithClient(() => useThread('r1', null));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('thread busca com ambos os ids', async () => {
    vi.mocked(api.messages.getThread).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useThread('r1', 'rel1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.messages.getThread).toHaveBeenCalledWith('r1', 'rel1');
  });

  it('directThread busca com staff + relative', async () => {
    vi.mocked(api.messages.getDirectThread).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useDirectThread('s1', 'rel1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.messages.getDirectThread).toHaveBeenCalledWith('s1', 'rel1');
  });
});

describe('moderação', () => {
  it('approve e reject invalidam messages.all', async () => {
    vi.mocked(api.messages.approve).mockResolvedValue({} as never);
    vi.mocked(api.messages.reject).mockResolvedValue({} as never);

    const { result: a, queryClient } = renderHookWithClient(() => useApproveMessage());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    a.current.mutate('m1');
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    expect(api.messages.approve).toHaveBeenCalledWith('m1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.messages.all });

    const { result: r } = renderHookWithClient(() => useRejectMessage());
    r.current.mutate('m1');
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(api.messages.reject).toHaveBeenCalledWith('m1');
  });
});
