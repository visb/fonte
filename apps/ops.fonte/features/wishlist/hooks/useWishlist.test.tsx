import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    wishlist: {
      getItems: jest.fn(),
      getPending: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useWishlistItems,
  usePendingWishlistItems,
  useAddWishlistItem,
  useRemoveWishlistItem,
  useApproveWishlistItem,
  useRejectWishlistItem,
} from './useWishlist';

const m = api as unknown as { wishlist: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useWishlist', () => {
  it('useWishlistItems lista por residente', async () => {
    m.wishlist.getItems.mockResolvedValue([{ id: 'w1' }]);
    const { result } = renderHookWithClient(() => useWishlistItems('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.wishlist.getItems).toHaveBeenCalledWith('r1');
  });

  it('useWishlistItems não dispara sem residente', () => {
    renderHookWithClient(() => useWishlistItems(''));
    expect(m.wishlist.getItems).not.toHaveBeenCalled();
  });

  it('usePendingWishlistItems busca pendentes', async () => {
    m.wishlist.getPending.mockResolvedValue([{ id: 'w1' }]);
    const { result } = renderHookWithClient(() => usePendingWishlistItems());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.wishlist.getPending).toHaveBeenCalledTimes(1);
  });

  it('useAddWishlistItem adiciona', async () => {
    m.wishlist.addItem.mockResolvedValue({ id: 'w1' });
    const { result } = renderHookWithClient(() => useAddWishlistItem('r1'));
    result.current.mutate({ description: 'Tênis' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.wishlist.addItem).toHaveBeenCalledWith('r1', { description: 'Tênis' });
  });

  it('useRemoveWishlistItem remove', async () => {
    m.wishlist.removeItem.mockResolvedValue(undefined);
    const { result } = renderHookWithClient(() => useRemoveWishlistItem('r1'));
    result.current.mutate('w1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.wishlist.removeItem).toHaveBeenCalledWith('r1', 'w1');
  });

  it('useApproveWishlistItem aprova', async () => {
    m.wishlist.approve.mockResolvedValue({ id: 'w1' });
    const { result } = renderHookWithClient(() => useApproveWishlistItem());
    result.current.mutate('w1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.wishlist.approve).toHaveBeenCalledWith('w1');
  });

  it('useRejectWishlistItem rejeita com motivo opcional', async () => {
    m.wishlist.reject.mockResolvedValue({ id: 'w1' });
    const { result } = renderHookWithClient(() => useRejectWishlistItem());
    result.current.mutate({ itemId: 'w1', data: { reason: 'sem orçamento' } as never });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.wishlist.reject).toHaveBeenCalledWith('w1', { reason: 'sem orçamento' });
  });
});
