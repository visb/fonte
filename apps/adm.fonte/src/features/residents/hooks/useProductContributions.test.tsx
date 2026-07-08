import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    storeroom: { listItems: vi.fn() },
    supplyRoom: { listItems: vi.fn() },
    residents: { declareProductContributions: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import { useInventoryCatalog, useDeclareProductContribution } from './useProductContributions';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useInventoryCatalog', () => {
  it('não busca sem houseId (enabled falso)', () => {
    const { result } = renderHookWithClient(() => useInventoryCatalog(''));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('respeita a opção enabled', () => {
    const { result } = renderHookWithClient(() => useInventoryCatalog('h1', { enabled: false }));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('une almoxarifado + dispensa num catálogo ordenado por nome', async () => {
    vi.mocked(api.storeroom.listItems).mockResolvedValue([
      { id: 's1', name: 'Arroz', unit: 'kg' },
    ] as never);
    vi.mocked(api.supplyRoom.listItems).mockResolvedValue([
      { id: 'p1', name: 'Sabão', unit: 'un' },
      { id: 'p2', name: 'Álcool', unit: 'L' },
    ] as never);

    const { result } = renderHookWithClient(() => useInventoryCatalog('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.storeroom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(api.supplyRoom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(result.current.data).toEqual([
      { id: 'p2', name: 'Álcool', unit: 'L' },
      { id: 's1', name: 'Arroz', unit: 'kg' },
      { id: 'p1', name: 'Sabão', unit: 'un' },
    ]);
  });
});

describe('useDeclareProductContribution', () => {
  it('envia lines para a parcela e invalida carnê + detalhe', async () => {
    vi.mocked(api.residents.declareProductContributions).mockResolvedValue([] as never);
    const { result, queryClient } = renderHookWithClient(() => useDeclareProductContribution('r1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate({
      receivableId: 'rec1',
      lines: [{ inventoryItemId: 's1', quantity: 3, unit: 'kg' }],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.residents.declareProductContributions).toHaveBeenCalledWith('r1', 'rec1', {
      lines: [{ inventoryItemId: 's1', quantity: 3, unit: 'kg' }],
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.receivables('r1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.detail('r1') });
  });
});
