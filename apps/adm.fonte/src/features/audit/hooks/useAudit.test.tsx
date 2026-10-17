import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { audit: { list: vi.fn(), event: vi.fn(), byTarget: vi.fn() } },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import { useAuditEvent, useAuditEvents } from './useAudit';

afterEach(() => vi.clearAllMocks());

describe('useAuditEvents', () => {
  it('pagina por cursor sob queryKeys.audit.events(filtros)', async () => {
    vi.mocked(api.audit.list)
      .mockResolvedValueOnce({ items: [{ id: 'e1' }], nextCursor: 'c1' } as never)
      .mockResolvedValueOnce({ items: [{ id: 'e2' }], nextCursor: null } as never);

    const filters = { action: 'resident.update' };
    const { result, queryClient } = renderHookWithClient(() => useAuditEvents(filters));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.audit.list).toHaveBeenCalledWith({ action: 'resident.update' });
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(api.audit.list).toHaveBeenLastCalledWith({ action: 'resident.update', cursor: 'c1' });
    expect(result.current.hasNextPage).toBe(false);
    expect(queryClient.getQueryData(queryKeys.audit.events(filters))).toBeDefined();
  });

  it('trocar filtro é outra chave (paginação reinicia)', async () => {
    vi.mocked(api.audit.list).mockResolvedValue({ items: [], nextCursor: null } as never);
    const { result, rerender } = renderHookWithClient(
      (props: { action: string }) => useAuditEvents({ action: props.action }),
      { initialProps: { action: 'a' } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ action: 'b' });
    await waitFor(() => expect(api.audit.list).toHaveBeenLastCalledWith({ action: 'b' }));
  });
});

describe('useAuditEvent', () => {
  it('não busca sem id; busca o detalhe com id', async () => {
    const { result: idle } = renderHookWithClient(() => useAuditEvent(null));
    expect(idle.current.fetchStatus).toBe('idle');

    vi.mocked(api.audit.event).mockResolvedValue({ id: 'e1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useAuditEvent('e1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.audit.event).toHaveBeenCalledWith('e1');
    expect(queryClient.getQueryData(queryKeys.audit.event('e1'))).toEqual({ id: 'e1' });
  });

  it('respeita enabled=false', () => {
    const { result } = renderHookWithClient(() => useAuditEvent('e1', { enabled: false }));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.audit.event).not.toHaveBeenCalled();
  });
});
