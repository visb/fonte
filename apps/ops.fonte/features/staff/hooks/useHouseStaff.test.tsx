import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: { houses: { listStaff: jest.fn() } },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { createTestQueryClient, renderHookWithClient } from '@/lib/test/utils';
import { useHouseStaff } from './useHouseStaff';

const listStaff = (api as unknown as { houses: { listStaff: jest.Mock } }).houses.listStaff;

beforeEach(() => jest.clearAllMocks());

describe('useHouseStaff', () => {
  it('busca os servos da casa na key staff.byHouse', async () => {
    const rows = [{ id: 's1', name: 'Ana', role: 'SERVANT', ledMinistries: [] }];
    listStaff.mockResolvedValue(rows);
    const client = createTestQueryClient();

    const { result } = renderHookWithClient(() => useHouseStaff('h1'), client);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listStaff).toHaveBeenCalledWith('h1');
    expect(client.getQueryData(queryKeys.staff.byHouse('h1'))).toEqual(rows);
  });

  it('sem casa não dispara a query', () => {
    renderHookWithClient(() => useHouseStaff(null));
    renderHookWithClient(() => useHouseStaff(undefined));
    expect(listStaff).not.toHaveBeenCalled();
  });
});
