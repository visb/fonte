import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    storeroom: { listItems: jest.fn() },
    supplyRoom: { listItems: jest.fn() },
    residents: {
      getReceivables: jest.fn(),
      getProductContributions: jest.fn(),
      declareProductContributions: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useInventoryCatalog,
  useResidentReceivables,
  useResidentProductContributions,
  useDeclareProductContribution,
} from './useProductContributions';

const m = api as unknown as {
  storeroom: Record<string, jest.Mock>;
  supplyRoom: Record<string, jest.Mock>;
  residents: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useInventoryCatalog', () => {
  it('une almoxarifado + dispensa e ordena por nome', async () => {
    m.storeroom.listItems.mockResolvedValue([{ id: 's1', name: 'Feijão', unit: 'kg', extra: 1 }]);
    m.supplyRoom.listItems.mockResolvedValue([{ id: 'd1', name: 'Arroz', unit: 'kg', category: 'X' }]);
    const { result } = renderHookWithClient(() => useInventoryCatalog('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.storeroom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(m.supplyRoom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(result.current.data).toEqual([
      { id: 'd1', name: 'Arroz', unit: 'kg' },
      { id: 's1', name: 'Feijão', unit: 'kg' },
    ]);
  });

  it('não dispara sem houseId', () => {
    renderHookWithClient(() => useInventoryCatalog(null));
    expect(m.storeroom.listItems).not.toHaveBeenCalled();
  });

  it('respeita enabled=false', () => {
    renderHookWithClient(() => useInventoryCatalog('h1', { enabled: false }));
    expect(m.storeroom.listItems).not.toHaveBeenCalled();
  });
});

describe('useResidentReceivables', () => {
  it('busca o carnê do filho', async () => {
    m.residents.getReceivables.mockResolvedValue([{ id: 'rc1' }]);
    const { result } = renderHookWithClient(() => useResidentReceivables('res-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.getReceivables).toHaveBeenCalledWith('res-1');
  });

  it('não dispara sem residentId', () => {
    renderHookWithClient(() => useResidentReceivables(undefined));
    expect(m.residents.getReceivables).not.toHaveBeenCalled();
  });
});

describe('useResidentProductContributions', () => {
  it('lista as contribuições da parcela', async () => {
    m.residents.getProductContributions.mockResolvedValue([{ id: 'pc1' }]);
    const { result } = renderHookWithClient(() =>
      useResidentProductContributions('res-1', 'rc-1'),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.getProductContributions).toHaveBeenCalledWith('res-1', 'rc-1');
  });

  it('não dispara sem receivableId', () => {
    renderHookWithClient(() => useResidentProductContributions('res-1', null));
    expect(m.residents.getProductContributions).not.toHaveBeenCalled();
  });

  it('respeita enabled=false', () => {
    renderHookWithClient(() =>
      useResidentProductContributions('res-1', 'rc-1', { enabled: false }),
    );
    expect(m.residents.getProductContributions).not.toHaveBeenCalled();
  });
});

describe('useDeclareProductContribution', () => {
  it('envia residentId, receivableId e { lines } ao cliente', async () => {
    m.residents.declareProductContributions.mockResolvedValue([{ id: 'pc1' }]);
    const { result } = renderHookWithClient(() => useDeclareProductContribution('res-1'));
    const lines = [{ inventoryItemId: 'i1', quantity: 2 }];
    result.current.mutate({ receivableId: 'rc-1', lines });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.declareProductContributions).toHaveBeenCalledWith('res-1', 'rc-1', {
      lines,
    });
  });

  it('propaga erro do cliente', async () => {
    m.residents.declareProductContributions.mockRejectedValue(new Error('boom'));
    const { result } = renderHookWithClient(() => useDeclareProductContribution('res-1'));
    result.current.mutate({ receivableId: 'rc-1', lines: [] });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
