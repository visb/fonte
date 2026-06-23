import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: { wishlist: { getItems: jest.fn() } },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import { useWishlistItems } from './useWishlist';

const mockApi = api as unknown as {
  wishlist: { getItems: jest.Mock };
};

describe('useWishlistItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busca os itens do residente quando há residentId', async () => {
    const items = [{ id: 'w1', description: 'Tênis 42', quantity: 1 }];
    mockApi.wishlist.getItems.mockResolvedValue(items);

    const { result } = renderHookWithClient(() => useWishlistItems('res-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.wishlist.getItems).toHaveBeenCalledWith('res-1');
    expect(result.current.data).toEqual(items);
  });

  it('não dispara a query quando residentId é vazio (enabled=false)', () => {
    renderHookWithClient(() => useWishlistItems(''));
    expect(mockApi.wishlist.getItems).not.toHaveBeenCalled();
  });
});
