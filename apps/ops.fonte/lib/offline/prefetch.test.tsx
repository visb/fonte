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
    houses: { listStaff: jest.fn() },
  },
}));

jest.mock('./sync/houseSnapshot', () => ({ syncHouseSnapshot: jest.fn() }));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { isPersistableQueryKey } from './constants';
import { syncHouseSnapshot } from './sync/houseSnapshot';
import {
  areWarmedKeysPersistable,
  useWarmHouseCache,
  warmHouseCache,
  warmedQueryKeys,
} from './prefetch';

const m = api as unknown as Record<string, Record<string, jest.Mock>>;
const snapshotSync = syncHouseSnapshot as jest.Mock;

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(m).forEach((module) =>
    Object.values(module).forEach((fn) => fn.mockResolvedValue([])),
  );
  snapshotSync.mockResolvedValue({ syncedAt: '2026-08-14T12:00:00.000Z', full: true });
});

describe('warmHouseCache', () => {
  it('popula o pacote de campo da casa', async () => {
    const client = createClient();
    m.storeroom.listItems.mockResolvedValue([{ id: 'i1' }]);

    await warmHouseCache(client, 'h1');

    expect(client.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([{ id: 'i1' }]);
    expect(client.getQueryData(queryKeys.supplyRoom.items('h1'))).toEqual([]);
    // Story 221: aquece a key que a lista de ocorrências consome.
    expect(client.getQueryData(queryKeys.incidents.byHouse('h1'))).toEqual([]);
    expect(client.getQueryData(queryKeys.activities.byHouse('h1'))).toEqual([]);
  });

  it('chama as APIs escopadas na casa', async () => {
    await warmHouseCache(createClient(), 'h1');

    expect(m.storeroom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(m.supplyRoom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(m.incidents.list).toHaveBeenCalledWith({ houseId: 'h1' });
    expect(m.houses.listStaff).toHaveBeenCalledWith('h1');
  });

  // Story 204: a lista *Servos* abre sem sinal no primeiro uso.
  it('pré-carrega os servos da casa na key compartilhada e persistível', async () => {
    const client = createClient();
    const staff = [{ id: 's1', name: 'Ana', role: 'SERVANT', ledMinistries: [] }];
    m.houses.listStaff.mockResolvedValue(staff);

    await warmHouseCache(client, 'h1');

    expect(client.getQueryData(queryKeys.staff.byHouse('h1'))).toEqual(staff);
    expect(warmedQueryKeys('h1')).toContainEqual([...queryKeys.staff.byHouse('h1')]);
    expect(isPersistableQueryKey(queryKeys.staff.byHouse('h1'))).toBe(true);
  });

  it('a ficha dos filhos vem do snapshot da casa — UM request, não N (story 175)', async () => {
    const client = createClient();

    await warmHouseCache(client, 'h1');

    expect(snapshotSync).toHaveBeenCalledTimes(1);
    expect(snapshotSync).toHaveBeenCalledWith(client, 'h1');
    // O fan-out por filho morreu junto: a lista não é mais aquecida à parte.
    expect(m.residents.listByHouse).not.toHaveBeenCalled();
  });

  it('sem casa não faz nada (staff de grupo de apoio, interno)', async () => {
    await warmHouseCache(createClient(), null);
    await warmHouseCache(createClient(), undefined);
    await warmHouseCache(createClient(), '');

    expect(m.storeroom.listItems).not.toHaveBeenCalled();
    expect(snapshotSync).not.toHaveBeenCalled();
  });

  it('falha de rede no aquecimento não estoura: é oportunista', async () => {
    const client = createClient();
    m.incidents.list.mockRejectedValue(new Error('sem rede'));
    m.storeroom.listItems.mockResolvedValue([{ id: 'i1' }]);

    await expect(warmHouseCache(client, 'h1')).resolves.toBeUndefined();
    // O resto do pacote entrou mesmo assim.
    expect(client.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([{ id: 'i1' }]);
  });

  it('snapshot indisponível não derruba o pacote de campo da story 171', async () => {
    const client = createClient();
    // `syncHouseSnapshot` já engole o erro de rede, mas nem por isso o
    // aquecimento pode depender dele para o resto entrar.
    snapshotSync.mockResolvedValue(null);
    m.storeroom.listItems.mockResolvedValue([{ id: 'i1' }]);

    await expect(warmHouseCache(client, 'h1')).resolves.toBeUndefined();

    expect(client.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([{ id: 'i1' }]);
  });

  it('não refaz o que acabou de ser aquecido (voltar do background não vira rajada)', async () => {
    const client = createClient();

    await warmHouseCache(client, 'h1');
    await warmHouseCache(client, 'h1');

    expect(m.storeroom.listItems).toHaveBeenCalledTimes(1);
    expect(snapshotSync).toHaveBeenCalledTimes(1);
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
    expect(m.storeroom.listItems).toHaveBeenCalledTimes(1);

    // Segundo plano não aquece; voltar ao ativo, sim (cache já expirado).
    client.clear();
    listeners.forEach((listener) => listener('background'));
    expect(m.storeroom.listItems).toHaveBeenCalledTimes(1);

    listeners.forEach((listener) => listener('active'));
    await Promise.resolve();
    expect(m.storeroom.listItems).toHaveBeenCalledTimes(2);

    unmount();
    spy.mockRestore();
  });

  it('sem casa não assina nada', () => {
    const spy = jest.spyOn(AppState, 'addEventListener');

    renderHook(() => useWarmHouseCache(null, createClient()));

    expect(spy).not.toHaveBeenCalled();
    expect(m.storeroom.listItems).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
