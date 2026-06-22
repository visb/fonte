import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    payables: {
      list: vi.fn(),
      summary: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      pay: vi.fn(),
      remove: vi.fn(),
      uploadAttachment: vi.fn(),
      removeAttachment: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  usePayables,
  usePayableSummary,
  useCreatePayable,
  useUpdatePayable,
  usePayPayable,
  useDeletePayable,
  useUploadPayableAttachment,
  useDeletePayableAttachment,
} from './usePayables';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('queries de payables', () => {
  it('list usa a queryKey de filtros', async () => {
    vi.mocked(api.payables.list).mockResolvedValue([{ id: 'p1' }] as never);
    const filters = { status: 'PENDING' };
    const { result, queryClient } = renderHookWithClient(() => usePayables(filters));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.payables.list).toHaveBeenCalledWith(filters);
    expect(queryClient.getQueryData(queryKeys.payables.list(filters))).toEqual([{ id: 'p1' }]);
  });

  it('summary usa a queryKey de summary', async () => {
    vi.mocked(api.payables.summary).mockResolvedValue({ total: 0 } as never);
    const filters = { from: '2026-01-01' };
    const { result } = renderHookWithClient(() => usePayableSummary(filters));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.payables.summary).toHaveBeenCalledWith(filters);
  });
});

describe('mutations de payables', () => {
  it('create invalida tudo', async () => {
    vi.mocked(api.payables.create).mockResolvedValue({ id: 'p1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useCreatePayable());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ description: 'X' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.payables.all });
  });

  it('update invalida tudo + detalhe', async () => {
    vi.mocked(api.payables.update).mockResolvedValue({ id: 'p1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdatePayable());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ id: 'p1', data: { description: 'Y' } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.payables.update).toHaveBeenCalledWith('p1', { description: 'Y' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.payables.detail('p1') });
  });

  it('pay monta FormData com paidAt e file', async () => {
    vi.mocked(api.payables.pay).mockResolvedValue({ id: 'p1' } as never);
    const { result } = renderHookWithClient(() => usePayPayable());
    result.current.mutate({ id: 'p1', paidAt: '2026-06-10', file: new File(['x'], 'c.pdf') });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const fd = vi.mocked(api.payables.pay).mock.calls[0][1] as FormData;
    expect(fd.get('paidAt')).toBe('2026-06-10');
    expect(fd.get('file')).toBeInstanceOf(File);
  });

  it('pay sem paidAt/file envia FormData vazio', async () => {
    vi.mocked(api.payables.pay).mockResolvedValue({ id: 'p1' } as never);
    const { result } = renderHookWithClient(() => usePayPayable());
    result.current.mutate({ id: 'p1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const fd = vi.mocked(api.payables.pay).mock.calls[0][1] as FormData;
    expect(fd.get('paidAt')).toBeNull();
  });

  it('delete invalida tudo', async () => {
    vi.mocked(api.payables.remove).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useDeletePayable());
    result.current.mutate('p1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.payables.remove).toHaveBeenCalledWith('p1');
  });

  it('upload/remove anexo invalidam tudo + detalhe', async () => {
    vi.mocked(api.payables.uploadAttachment).mockResolvedValue({} as never);
    vi.mocked(api.payables.removeAttachment).mockResolvedValue(undefined as never);

    const { result, queryClient } = renderHookWithClient(() => useUploadPayableAttachment());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ id: 'p1', file: new File(['x'], 'a.pdf') });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.payables.uploadAttachment).toHaveBeenCalledWith('p1', expect.any(FormData));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.payables.detail('p1') });

    const { result: r2 } = renderHookWithClient(() => useDeletePayableAttachment());
    r2.current.mutate('p1');
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.payables.removeAttachment).toHaveBeenCalledWith('p1');
  });
});
