import { waitFor } from '@testing-library/react-native';

// api-client mockado: nenhuma chamada HTTP real. O checkin de presença em grupo
// de apoio (família) é a regra de negócio central desta feature.
jest.mock('@/lib/api', () => ({
  api: {
    supportGroups: {
      addRelativeCheckin: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import { useSupportGroupCheckin } from './useCheckin';

const mockApi = api as unknown as {
  supportGroups: { addRelativeCheckin: jest.Mock };
};

describe('useSupportGroupCheckin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registra a presença passando o token lido do QR ao api-client', async () => {
    const checkin = { id: 'ci-1', meetingId: 'mt-1', presentAt: '2026-06-23T10:00:00Z' };
    mockApi.supportGroups.addRelativeCheckin.mockResolvedValue(checkin);

    const { result } = renderHookWithClient(() => useSupportGroupCheckin());
    result.current.mutate('tok-abc');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.supportGroups.addRelativeCheckin).toHaveBeenCalledWith({ token: 'tok-abc' });
    expect(result.current.data).toEqual(checkin);
  });

  it('propaga erro quando o token é inválido/expirado (presença barrada)', async () => {
    mockApi.supportGroups.addRelativeCheckin.mockRejectedValue(
      new Error('QR inválido'),
    );

    const { result } = renderHookWithClient(() => useSupportGroupCheckin());
    result.current.mutate('tok-ruim');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
