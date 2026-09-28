import { waitFor } from '@testing-library/react-native';
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return { ...actual, useMutation: jest.fn(actual.useMutation) };
});

jest.mock('@/lib/api', () => ({
  api: {
    storeroom: { listItems: jest.fn() },
    supplyRoom: { listItems: jest.fn() },
    residents: {
      getReceivables: jest.fn(),
      getReceivablesSummary: jest.fn(),
      getProductContributions: jest.fn(),
      declareProductContributions: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import { OUTBOX_MUTATION_KEYS } from '@/lib/offline/outbox';
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
      { id: 'd1', name: 'Arroz', unit: 'kg', source: 'supply' },
      { id: 's1', name: 'Feijão', unit: 'kg', source: 'storeroom' },
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
  // Story 186 — o ops usa o RECORTE. A rota cheia (`getReceivables`) é
  // ADMIN/COORDINATOR e devolvia 403 para o servo: chamá-la aqui era o que
  // matava a declaração de contribuição em produtos em campo.
  it('busca o recorte do carnê, não o carnê cheio', async () => {
    m.residents.getReceivablesSummary.mockResolvedValue([
      { id: 'rc1', referenceMonth: '2026-08-01', status: 'PENDING' },
    ]);
    const { result } = renderHookWithClient(() => useResidentReceivables('res-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.getReceivablesSummary).toHaveBeenCalledWith('res-1');
    expect(m.residents.getReceivables).not.toHaveBeenCalled();
  });

  it('não dispara sem residentId', () => {
    renderHookWithClient(() => useResidentReceivables(undefined));
    expect(m.residents.getReceivablesSummary).not.toHaveBeenCalled();
  });

  it('respeita enabled=false', () => {
    renderHookWithClient(() => useResidentReceivables('res-1', { enabled: false }));
    expect(m.residents.getReceivablesSummary).not.toHaveBeenCalled();
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
    const { result } = renderHookWithClient(() => useDeclareProductContribution());
    const lines = [{ inventoryItemId: 'i1', quantity: 2 }];
    result.current.mutate({ residentId: 'res-1', houseId: 'h1', referenceMonth: '2026-09-01', receivableId: 'rc-1', lines });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.declareProductContributions).toHaveBeenCalledWith('res-1', 'rc-1', {
      lines,
    }, { idempotencyKey: expect.any(String) });
  });

  it('propaga erro do cliente', async () => {
    m.residents.declareProductContributions.mockRejectedValue(new Error('boom'));
    const { result } = renderHookWithClient(() => useDeclareProductContribution());
    result.current.mutate({ residentId: 'res-1', houseId: 'h1', referenceMonth: '2026-09-01', receivableId: 'rc-1', lines: [] });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
  it('registers only a mutationKey, never an inline mutationFn', () => {
    const query = require('@tanstack/react-query');
    renderHookWithClient(() => useDeclareProductContribution());
    expect(query.useMutation).toHaveBeenCalledWith({ mutationKey: OUTBOX_MUTATION_KEYS.productContributionDeclare });
    expect(query.useMutation.mock.calls[0][0]).not.toHaveProperty('mutationFn');
  });
});
