import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import type { Resident } from '@fonte/api-client';
import { queryKeys } from '@/lib/queryKeys';
import { createWebDriver } from './driver.asyncStorage';
import { setResidentStoreDriver } from './driver';
import { hydrateResidentQueries } from './hydrate';
import {
  saveHouseMinistries,
  saveResidentDetail,
  saveResidentList,
} from './residentStore';

function resident(id: string, name: string): Resident {
  return { id, name, houseId: 'h1', status: 'ACTIVE' } as unknown as Resident;
}

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  setResidentStoreDriver(createWebDriver());
});

afterEach(() => {
  jest.restoreAllMocks();
  setResidentStoreDriver(null);
});

describe('hydrateResidentQueries', () => {
  it('semeia lista, contagem, ficha, blocos de detalhe e ministérios', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    await saveResidentDetail('r1', 'follow_ups', [{ id: 'f1' }] as never);
    await saveResidentDetail('r1', 'attachments', [{ id: 'a1' }] as never);
    await saveResidentDetail('r1', 'consents', [{ purpose: 'IMAGE_PUBLICATION' }] as never);
    await saveResidentDetail('r1', 'receivables', [{ id: 'p1' }] as never);
    await saveHouseMinistries('h1', [{ id: 'm1' }] as never);

    const client = createClient();
    await hydrateResidentQueries(client);

    expect(client.getQueryData(queryKeys.residents.byHouse('h1'))).toEqual([
      expect.objectContaining({ id: 'r1' }),
    ]);
    expect(client.getQueryData(queryKeys.residents.countByHouse('h1'))).toHaveLength(1);
    expect(client.getQueryData(queryKeys.residents.detail('r1'))).toMatchObject({ name: 'Ana' });
    expect(client.getQueryData(queryKeys.residents.followUps('r1'))).toEqual([{ id: 'f1' }]);
    expect(client.getQueryData(queryKeys.residents.attachments('r1'))).toEqual([{ id: 'a1' }]);
    expect(client.getQueryData(queryKeys.residents.consents('r1'))).toEqual([
      { purpose: 'IMAGE_PUBLICATION' },
    ]);
    expect(client.getQueryData(queryKeys.residents.receivables('r1'))).toEqual([{ id: 'p1' }]);
    expect(client.getQueryData(queryKeys.houses.ministries('h1'))).toEqual([{ id: 'm1' }]);
  });

  it('o dado entra com o carimbo do disco, não como se fosse desta sessão', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    jest.restoreAllMocks();

    const client = createClient();
    await hydrateResidentQueries(client);

    const state = client.getQueryState(queryKeys.residents.byHouse('h1'));
    expect(state?.dataUpdatedAt).toBe(1_700_000_000_000);
  });

  it('a lista entra pendente de confirmação do servidor (a contagem precisa de quem não é "presente")', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    await saveResidentDetail('r1', 'follow_ups', [{ id: 'f1' }] as never);

    const client = createClient();
    await hydrateResidentQueries(client);

    // Lista e contagem: o store guarda só os filhos presentes da casa, então a
    // tela busca no servidor ao montar quando houver rede (é assim que a
    // contagem enxerga quem entrou por ela, `CENSUS_ADDED`).
    expect(client.getQueryState(queryKeys.residents.byHouse('h1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.residents.countByHouse('h1'))?.isInvalidated).toBe(true);
    // Os blocos da ficha vêm completos por filho: não precisam de confirmação.
    expect(client.getQueryState(queryKeys.residents.followUps('r1'))?.isInvalidated).toBe(false);
    expect(client.getQueryState(queryKeys.residents.detail('r1'))?.isInvalidated).toBe(false);
  });

  it('store vazio não semeia nada (e não estoura)', async () => {
    const client = createClient();

    await expect(hydrateResidentQueries(client)).resolves.toBeUndefined();

    expect(client.getQueryData(queryKeys.residents.byHouse('h1'))).toBeUndefined();
  });
});
