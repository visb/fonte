import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    events: {
      listInternal: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { createTestQueryClient, renderHookWithClient } from '@/lib/test/utils';
import { useInternalEvents } from './useInternalEvents';

const mockApi = api as unknown as { events: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useInternalEvents', () => {
  it('lista os eventos internos pela queryKey dedicada (story 94)', async () => {
    mockApi.events.listInternal.mockResolvedValue([{ id: 'i1' }]);
    const queryClient = createTestQueryClient();
    const { result } = renderHookWithClient(() => useInternalEvents(), queryClient);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.events.listInternal).toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.events.internal)).toEqual([{ id: 'i1' }]);
  });
});
