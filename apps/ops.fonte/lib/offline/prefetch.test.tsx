import { AppState } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';

jest.mock('@/lib/api', () => ({
  api: {
    residents: { listByHouse: jest.fn() },
    storeroom: { listItems: jest.fn() },
    supplyRoom: { listItems: jest.fn() },
    incidents: { list: jest.fn() },
    activities: { list: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { isPersistableQueryKey } from './constants';
import {
  areWarmedKeysPersistable,
  useWarmHouseCache,
  warmHouseCache,
  warmedQueryKeys,
} from './prefetch';

const m = api as unknown as Record<string, Record<string, jest.Mock>>;

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(m).forEach((module) =>
    Object.values(module).forEach((fn) => fn.mockResolvedValue([])),
  );
});

describe('warmHouseCache', () => {
  it('popula o pacote de campo da casa', async () => {
    const client = createClient();
    m.residents.listByHouse.mockResolvedValue([{ id: 'r1' }]);
    m.storeroom.listItems.mockResolvedValue([{ id: 'i1' }]);

    await warmHouseCache(client, 'h1');

    expect(client.getQueryData(queryKeys.residents.byHouse('h1'))).toEqual([{ id: 'r1' }]);
    expect(client.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([{ id: 'i1' }]);
    expect(client.getQueryData(queryKeys.supplyRoom.items('h1'))).toEqual([]);
    expect(client.getQueryData(queryKeys.incidents.todayByHouse('h1'))).toEqual([]);
    expect(client.getQueryData(queryKeys.activities.byHouse('h1'))).toEqual([]);
  });

  it('chama as APIs escopadas na casa', async () => {
    await warmHouseCache(createClient(), 'h1');

    expect(m.residents.listByHouse).toHaveBeenCalledWith('h1');
    expect(m.storeroom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(m.supplyRoom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(m.incidents.list).toHaveBeenCalledWith({ houseId: 'h1' });
  });

  it('sem casa não faz nada (staff de grupo de apoio, interno)', async () => {
    await warmHouseCache(createClient(), null);
    await warmHouseCache(createClient(), undefined);
    await warmHouseCache(createClient(), '');

    expect(m.residents.listByHouse).not.toHaveBeenCalled();
  });

  it('falha de rede no aquecimento não estoura: é oportunista', async () => {
    const client = createClient();
    m.residents.listByHouse.mockRejectedValue(new Error('sem rede'));
    m.storeroom.listItems.mockResolvedValue([{ id: 'i1' }]);

    await expect(warmHouseCache(client, 'h1')).resolves.toBeUndefined();
    // O resto do pacote entrou mesmo assim.
    expect(client.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([{ id: 'i1' }]);
  });

  it('não refaz o que acabou de ser aquecido (voltar do background não vira rajada)', async () => {
    const client = createClient();

    await warmHouseCache(client, 'h1');
    await warmHouseCache(client, 'h1');

    expect(m.residents.listByHouse).toHaveBeenCalledTimes(1);
  });

  it('tudo que é aquecido pode ser persistido (allowlist LGPD do epic 167)', () => {
    expect(warmedQueryKeys('h1').every(isPersistableQueryKey)).toBe(true);
    expect(areWarmedKeysPersistable('h1')).toBe(true);
  });
});

describe('useWarmHouseCache', () => {
  it('aquece ao montar e ao voltar para o primeiro plano', async () => {
    const client = createClient();
    const listeners: ((status: string) => void)[] = [];
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        listeners.push(listener as (status: string) => void);
        return { remove: jest.fn() } as never;
      });

    const { unmount } = renderHook(() => useWarmHouseCache('h1', client));
    await Promise.resolve();
    expect(m.residents.listByHouse).toHaveBeenCalledTimes(1);

    // Segundo plano não aquece; voltar ao ativo, sim (cache já expirado).
    client.clear();
    listeners.forEach((listener) => listener('background'));
    expect(m.residents.listByHouse).toHaveBeenCalledTimes(1);

    listeners.forEach((listener) => listener('active'));
    await Promise.resolve();
    expect(m.residents.listByHouse).toHaveBeenCalledTimes(2);

    unmount();
    spy.mockRestore();
  });

  it('sem casa não assina nada', () => {
    const spy = jest.spyOn(AppState, 'addEventListener');

    renderHook(() => useWarmHouseCache(null, createClient()));

    expect(spy).not.toHaveBeenCalled();
    expect(m.residents.listByHouse).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
