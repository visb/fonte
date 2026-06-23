import { waitFor } from '@testing-library/react-native';
import { MovementType } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    storeroom: {
      listItems: jest.fn(),
      listMovements: jest.fn(),
      createMovement: jest.fn(),
      createItem: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useStoreroomItems,
  useStoreroomMovements,
  useCreateMovement,
  useCreateStoreroomItem,
} from './useStoreroom';

const m = api as unknown as { storeroom: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useStoreroom', () => {
  it('useStoreroomItems busca por casa', async () => {
    m.storeroom.listItems.mockResolvedValue([{ id: 'i1' }]);
    const { result } = renderHookWithClient(() => useStoreroomItems('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.storeroom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
  });

  it('useStoreroomItems não dispara sem casa', () => {
    renderHookWithClient(() => useStoreroomItems(null));
    expect(m.storeroom.listItems).not.toHaveBeenCalled();
  });

  it('useStoreroomMovements busca por item', async () => {
    m.storeroom.listMovements.mockResolvedValue([{ id: 'mv1' }]);
    const { result } = renderHookWithClient(() => useStoreroomMovements('i1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.storeroom.listMovements).toHaveBeenCalledWith({ itemId: 'i1' });
  });

  it('useStoreroomMovements não dispara sem item', () => {
    renderHookWithClient(() => useStoreroomMovements(undefined));
    expect(m.storeroom.listMovements).not.toHaveBeenCalled();
  });

  it('useCreateMovement repassa o payload', async () => {
    m.storeroom.createMovement.mockResolvedValue({ id: 'mv1' });
    const { result } = renderHookWithClient(() => useCreateMovement());
    const input = {
      itemId: 'i1',
      type: MovementType.IN,
      quantity: 5,
      responsibleId: 'staff-1',
      date: '2026-01-01',
      notes: null,
    };
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.storeroom.createMovement).toHaveBeenCalledWith(input);
  });

  it('useCreateStoreroomItem repassa o payload', async () => {
    m.storeroom.createItem.mockResolvedValue({ id: 'i1' });
    const { result } = renderHookWithClient(() => useCreateStoreroomItem());
    const input = { name: 'Arroz', unit: 'kg', houseId: 'h1' };
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.storeroom.createItem).toHaveBeenCalledWith(input);
  });
});
