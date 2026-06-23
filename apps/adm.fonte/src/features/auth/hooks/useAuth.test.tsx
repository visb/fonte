import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { auth: { changePassword: vi.fn() } },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/test/utils';
import { useChangePassword } from './useAuth';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useChangePassword', () => {
  it('chama api.auth.changePassword com a nova senha', async () => {
    vi.mocked(api.auth.changePassword).mockResolvedValue({} as never);
    const { result } = renderHookWithClient(() => useChangePassword());
    result.current.mutate('novaSenha123');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.auth.changePassword).toHaveBeenCalledWith({ newPassword: 'novaSenha123' });
  });
});
