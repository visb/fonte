import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { backup: { list: vi.fn(), run: vi.fn() } },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import { useBackups, useRunBackup } from './useBackups';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useBackups', () => {
  it('lista backups pela queryKey backup.all', async () => {
    vi.mocked(api.backup.list).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useBackups());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.backup.list).toHaveBeenCalled();
  });
});

describe('useRunBackup', () => {
  it('roda backup e invalida backup.all no sucesso', async () => {
    vi.mocked(api.backup.run).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useRunBackup());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.backup.run).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.backup.all });
  });
});
