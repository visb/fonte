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

/**
 * A linha como `GET /houses/:id/residents` devolve (e como o store grava):
 * sem `houseId`, entre outros campos que a ficha precisa (story 185).
 */
function leanResident(id: string, name: string): Resident {
  return {
    id,
    name,
    status: 'ACTIVE',
    entryDate: '2026-01-10',
    photoUrl: null,
    photoThumbUrl: null,
  } as unknown as Resident;
}

function createClient(staleTime = 0): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime } } });
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
    // Os blocos de detalhe guardam a resposta inteira do endpoint que a tela
    // consome: não precisam de confirmação.
    expect(client.getQueryState(queryKeys.residents.followUps('r1'))?.isInvalidated).toBe(false);
  });

  it('a ficha abre com o dado do disco, mas pendente de confirmação (a linha do store é enxuta)', async () => {
    await saveResidentList('h1', [leanResident('r1', 'Marcelo Reacolhido')]);

    const client = createClient();
    await hydrateResidentQueries(client);

    // Offline-first não regride: a tela abre com o que está no aparelho...
    expect(client.getQueryData(queryKeys.residents.detail('r1'))).toMatchObject({
      id: 'r1',
      name: 'Marcelo Reacolhido',
    });
    // ...e ainda assim busca no servidor ao montar, quando houver rede.
    expect(client.getQueryState(queryKeys.residents.detail('r1'))?.isInvalidated).toBe(true);
  });

  it('regressão story 185: com `staleTime` de 30s a ficha do store continua stale (o consumidor rebusca)', async () => {
    // A linha enxuta não tem `houseId`; nascer fresca fazia a ficha aberta nos
    // primeiros 30s após o login mandar `houseId: ''` para o catálogo de
    // produtos ("Nenhum produto encontrado.") e esconder a troca de ministério.
    await saveResidentList('h1', [leanResident('r1', 'Marcelo Reacolhido')]);

    const client = createClient(30_000);
    await hydrateResidentQueries(client);

    const detail = client
      .getQueryCache()
      .find({ queryKey: queryKeys.residents.detail('r1'), exact: true });
    expect(detail?.state.data).toMatchObject({ id: 'r1' });
    expect(detail?.state.data).not.toMatchObject({ houseId: expect.anything() });
    expect(detail?.isStale()).toBe(true);
  });

  it('hidratar não dispara busca (`refetchType: none`): boot offline não queima tentativa', async () => {
    await saveResidentList('h1', [leanResident('r1', 'Marcelo Reacolhido')]);

    const client = createClient(30_000);
    const queryFn = jest.fn().mockResolvedValue([]);
    client.setQueryDefaults(queryKeys.residents.detail('r1'), { queryFn });
    client.setQueryDefaults(queryKeys.residents.byHouse('h1'), { queryFn });
    client.setQueryDefaults(queryKeys.residents.countByHouse('h1'), { queryFn });

    await hydrateResidentQueries(client);
    await Promise.resolve();

    expect(queryFn).not.toHaveBeenCalled();
    expect(client.getQueryState(queryKeys.residents.detail('r1'))?.fetchStatus).toBe('idle');
    expect(client.getQueryState(queryKeys.residents.byHouse('h1'))?.fetchStatus).toBe('idle');
  });

  it('a ficha pendente mantém o carimbo do disco (a marcação não finge frescor novo)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    await saveResidentList('h1', [leanResident('r1', 'Marcelo Reacolhido')]);
    jest.restoreAllMocks();

    const client = createClient(30_000);
    await hydrateResidentQueries(client);

    expect(client.getQueryState(queryKeys.residents.detail('r1'))?.dataUpdatedAt).toBe(
      1_700_000_000_000,
    );
  });

  it('store vazio não semeia nada (e não estoura)', async () => {
    const client = createClient();

    await expect(hydrateResidentQueries(client)).resolves.toBeUndefined();

    expect(client.getQueryData(queryKeys.residents.byHouse('h1'))).toBeUndefined();
  });
});
