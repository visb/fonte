import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    documentTemplates: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    appSettings: { get: vi.fn(), update: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useDocumentTemplates,
  useCreateDocumentTemplate,
  useUpdateDocumentTemplate,
  useDeleteDocumentTemplate,
} from './useDocumentTemplates';
import { useAppSettings, useUpdateAppSettings } from './useAppSettings';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useDocumentTemplates', () => {
  it('lista e respeita enabled:false (idle)', async () => {
    vi.mocked(api.documentTemplates.list).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useDocumentTemplates());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.documentTemplates.list).toHaveBeenCalled();

    const { result: off } = renderHookWithClient(() => useDocumentTemplates({ enabled: false }));
    expect(off.current.fetchStatus).toBe('idle');
  });

  it('create/update/delete invalidam documentTemplates.all', async () => {
    vi.mocked(api.documentTemplates.create).mockResolvedValue({} as never);
    vi.mocked(api.documentTemplates.update).mockResolvedValue({} as never);
    vi.mocked(api.documentTemplates.delete).mockResolvedValue({} as never);

    const { result: c, queryClient } = renderHookWithClient(() => useCreateDocumentTemplate());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ name: 'T', html: '<p/>' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.documentTemplates.all });

    const { result: u } = renderHookWithClient(() => useUpdateDocumentTemplate());
    u.current.mutate({ id: 't1', data: { name: 'N' } } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.documentTemplates.update).toHaveBeenCalledWith('t1', { name: 'N' });

    const { result: d } = renderHookWithClient(() => useDeleteDocumentTemplate());
    d.current.mutate('t1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.documentTemplates.delete).toHaveBeenCalledWith('t1');
  });
});

describe('useAppSettings', () => {
  it('lê settings atuais', async () => {
    vi.mocked(api.appSettings.get).mockResolvedValue({} as never);
    const { result } = renderHookWithClient(() => useAppSettings());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.appSettings.get).toHaveBeenCalled();
  });

  it('update invalida appSettings.current', async () => {
    vi.mocked(api.appSettings.update).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdateAppSettings());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ childAppEnabled: true } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.appSettings.current });
  });
});
