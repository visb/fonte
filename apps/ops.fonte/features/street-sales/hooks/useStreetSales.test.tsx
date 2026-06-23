import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    streetSales: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useStreetSales,
  useCreateStreetSale,
  useUpdateStreetSale,
  useDeleteStreetSale,
} from './useStreetSales';

const m = api as unknown as { streetSales: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useStreetSales', () => {
  it('lista por casa quando houseId presente', async () => {
    m.streetSales.list.mockResolvedValue([{ id: 's1' }]);
    const { result } = renderHookWithClient(() => useStreetSales('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.streetSales.list).toHaveBeenCalledWith({ houseId: 'h1' });
  });

  it('não dispara sem casa', () => {
    renderHookWithClient(() => useStreetSales(undefined));
    expect(m.streetSales.list).not.toHaveBeenCalled();
  });

  it('useCreateStreetSale cria e invalida pela casa do payload', async () => {
    m.streetSales.create.mockResolvedValue({ id: 's1' });
    const { result } = renderHookWithClient(() => useCreateStreetSale());
    result.current.mutate({ houseId: 'h1', amountCents: 1000 } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.streetSales.create).toHaveBeenCalledWith({ houseId: 'h1', amountCents: 1000 });
  });

  it('useUpdateStreetSale atualiza por id', async () => {
    m.streetSales.update.mockResolvedValue({ id: 's1' });
    const { result } = renderHookWithClient(() => useUpdateStreetSale('h1'));
    result.current.mutate({ id: 's1', data: { amountCents: 2000 } as never });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.streetSales.update).toHaveBeenCalledWith('s1', { amountCents: 2000 });
  });

  it('useDeleteStreetSale remove por id', async () => {
    m.streetSales.remove.mockResolvedValue(undefined);
    const { result } = renderHookWithClient(() => useDeleteStreetSale('h1'));
    result.current.mutate('s1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.streetSales.remove).toHaveBeenCalledWith('s1');
  });
});
