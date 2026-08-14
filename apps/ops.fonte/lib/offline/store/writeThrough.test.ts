import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import type { Resident } from '@fonte/api-client';
import { queryKeys } from '@/lib/queryKeys';
import { createWebDriver } from './driver.asyncStorage';
import { setResidentStoreDriver } from './driver';
import { hydrateResidentQueries } from './hydrate';
import {
  readHouseMinistries,
  readResident,
  readResidentDetail,
  readResidentList,
  saveResidentList,
} from './residentStore';
import {
  attachResidentStoreWriteThrough,
  residentStoreWriteTarget,
  writeQueryThrough,
} from './writeThrough';

function resident(id: string, name: string): Resident {
  return { id, name, houseId: 'h1', status: 'ACTIVE' } as unknown as Resident;
}

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  setResidentStoreDriver(createWebDriver());
});

afterEach(() => setResidentStoreDriver(null));

describe('residentStoreWriteTarget — allowlist do store', () => {
  it.each([
    [queryKeys.residents.byHouse('h1'), { table: 'list', houseId: 'h1' }],
    [queryKeys.residents.countByHouse('h1'), { table: 'list', houseId: 'h1' }],
    [queryKeys.residents.detail('r1'), { table: 'resident', residentId: 'r1' }],
    [queryKeys.residents.followUps('r1'), { table: 'detail', residentId: 'r1', kind: 'follow_ups' }],
    [
      queryKeys.residents.attachments('r1'),
      { table: 'detail', residentId: 'r1', kind: 'attachments' },
    ],
    [queryKeys.residents.consents('r1'), { table: 'detail', residentId: 'r1', kind: 'consents' }],
    [
      queryKeys.residents.receivables('r1'),
      { table: 'detail', residentId: 'r1', kind: 'receivables' },
    ],
    [queryKeys.houses.ministries('h1'), { table: 'ministries', houseId: 'h1' }],
  ])('%s vai para o store', (queryKey, expected) => {
    expect(residentStoreWriteTarget(queryKey)).toEqual(expected);
  });

  it.each([
    ['residents.all (sem casa)', queryKeys.residents.all],
    ['messages.conversations', queryKeys.messages.conversations],
    ['wishlist.items', queryKeys.wishlist.items('r1')],
    ['relatives.byResident', queryKeys.relatives.byResident('r1')],
    ['incidents.byHouse', queryKeys.incidents.byHouse('h1')],
    ['chave sem string no primeiro segmento', [{ scope: 'residents' }, 'r1']],
  ])('%s não entra no store (nada por omissão)', (_label, queryKey) => {
    expect(residentStoreWriteTarget(queryKey as readonly unknown[])).toBeNull();
  });
});

describe('writeQueryThrough', () => {
  it('grava a lista da casa', async () => {
    await writeQueryThrough(queryKeys.residents.byHouse('h1'), [resident('r1', 'Ana')]);

    expect((await readResidentList('h1'))?.data).toHaveLength(1);
  });

  it('grava ficha, bloco de detalhe e ministérios', async () => {
    await writeQueryThrough(queryKeys.residents.detail('r1'), resident('r1', 'Ana'));
    await writeQueryThrough(queryKeys.residents.followUps('r1'), [{ id: 'f1' }]);
    await writeQueryThrough(queryKeys.houses.ministries('h1'), [{ id: 'm1' }]);

    expect((await readResident('r1'))?.data.name).toBe('Ana');
    expect((await readResidentDetail('r1', 'follow_ups'))?.data).toEqual([{ id: 'f1' }]);
    expect((await readHouseMinistries('h1'))?.data).toEqual([{ id: 'm1' }]);
  });

  it('ignora chave fora do domínio e resposta vazia', async () => {
    await writeQueryThrough(queryKeys.messages.conversations, [{ id: 'x' }]);
    await writeQueryThrough(queryKeys.residents.detail('r1'), undefined);
    await writeQueryThrough(queryKeys.residents.followUps('r1'), null);
    // Bloco que deveria ser lista chegando como objeto não corrompe o store.
    await writeQueryThrough(queryKeys.residents.byHouse('h1'), { erro: true });
    await writeQueryThrough(queryKeys.houses.ministries('h1'), { erro: true });
    await writeQueryThrough(queryKeys.residents.followUps('r1'), { erro: true });

    expect(await readResidentDetail('r1', 'follow_ups')).toBeNull();

    expect(await readResident('r1')).toBeNull();
    expect(await readResidentList('h1')).toBeNull();
    expect(await readHouseMinistries('h1')).toBeNull();
  });
});

describe('attachResidentStoreWriteThrough', () => {
  it('query do domínio que volta da rede cai no store', async () => {
    const client = createClient();
    const stop = attachResidentStoreWriteThrough(client);

    await client.fetchQuery({
      queryKey: queryKeys.residents.followUps('r1'),
      queryFn: async () => [{ id: 'f1' }],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((await readResidentDetail('r1', 'follow_ups'))?.data).toEqual([{ id: 'f1' }]);
    stop();
  });

  it('hidratação não é regravada no store (sem loop store → cache → store)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    const original = (await readResidentList('h1'))!.updatedAt;

    const client = createClient();
    const stop = attachResidentStoreWriteThrough(client);

    jest.spyOn(Date, 'now').mockReturnValue(50_000);
    await hydrateResidentQueries(client);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((await readResidentList('h1'))!.updatedAt).toBe(original);
    stop();
    jest.restoreAllMocks();
  });

  it('erro de query não grava nada e não derruba a tela', async () => {
    const client = createClient();
    const stop = attachResidentStoreWriteThrough(client);

    await expect(
      client.fetchQuery({
        queryKey: queryKeys.residents.detail('r1'),
        queryFn: async () => {
          throw new Error('sem rede');
        },
      }),
    ).rejects.toThrow('sem rede');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await readResident('r1')).toBeNull();
    stop();
  });

  it('depois do unsubscribe nada mais é gravado', async () => {
    const client = createClient();
    const stop = attachResidentStoreWriteThrough(client);
    stop();

    await client.fetchQuery({
      queryKey: queryKeys.residents.detail('r1'),
      queryFn: async () => resident('r1', 'Ana'),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await readResident('r1')).toBeNull();
  });
});
