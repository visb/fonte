import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MovementType, SupplyRoomCategory } from '@fonte/types';
import type { ReactNode } from 'react';

// api-client mockado: nenhuma chamada HTTP real é feita.
jest.mock('@/lib/api', () => ({
  api: {
    supplyRoom: {
      listItems: jest.fn(),
      listMovements: jest.fn(),
      createMovement: jest.fn(),
      createItem: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import {
  useSupplyRoomItems,
  useCreateSupplyItem,
} from './useSupplyRoom';

const mockApi = api as unknown as {
  supplyRoom: {
    listItems: jest.Mock;
    createItem: jest.Mock;
  };
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useSupplyRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSupplyRoomItems', () => {
    it('busca itens passando o houseId para o api-client', async () => {
      const items = [{ id: 'i1', name: 'Detergente' }];
      mockApi.supplyRoom.listItems.mockResolvedValue(items);

      const { result } = renderHook(() => useSupplyRoomItems('house-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.supplyRoom.listItems).toHaveBeenCalledWith({
        houseId: 'house-1',
      });
      expect(result.current.data).toEqual(items);
    });

    it('não dispara a query quando houseId é nulo (enabled=false)', () => {
      renderHook(() => useSupplyRoomItems(null), { wrapper: createWrapper() });
      expect(mockApi.supplyRoom.listItems).not.toHaveBeenCalled();
    });
  });

  describe('useCreateSupplyItem', () => {
    it('repassa o payload ao api-client na mutation', async () => {
      mockApi.supplyRoom.createItem.mockResolvedValue({ id: 'new' });

      const { result } = renderHook(() => useCreateSupplyItem(), {
        wrapper: createWrapper(),
      });

      const input = {
        name: 'Álcool',
        unit: 'L',
        category: SupplyRoomCategory.HYGIENE,
        houseId: 'house-1',
      };
      result.current.mutate(input);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.supplyRoom.createItem).toHaveBeenCalledWith(input);
    });
  });
});

// Garante que MovementType é importável no contexto de teste (sanity do alias).
it('MovementType enum disponível', () => {
  expect(MovementType.IN).toBe('IN');
});
