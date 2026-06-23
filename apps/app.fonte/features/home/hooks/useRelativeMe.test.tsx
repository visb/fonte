import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: { relatives: { me: jest.fn() } },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import { useRelativeMe } from './useRelativeMe';

const mockApi = api as unknown as { relatives: { me: jest.Mock } };

describe('useRelativeMe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busca o perfil do familiar logado', async () => {
    const me = { id: 'rel-1', name: 'Ana', residentId: 'res-1' };
    mockApi.relatives.me.mockResolvedValue(me);

    const { result } = renderHookWithClient(() => useRelativeMe());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.relatives.me).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(me);
  });
});
