import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Query } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { PERSIST_BUSTER, PERSIST_KEY, PERSIST_MAX_AGE, QUERY_GC_TIME } from './constants';
import { clearPersistedCache, dehydrateOptions, shouldDehydrateQuery } from './persister';

/** Query mínima para a decisão de desidratação (chave + status). */
function query(queryKey: readonly unknown[], status: 'success' | 'pending' | 'error' = 'success'): Query {
  return { queryKey, state: { status } } as unknown as Query;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('shouldDehydrateQuery — allowlist (LGPD)', () => {
  it.each([
    ['residents.all', queryKeys.residents.all],
    ['residents.byHouse', queryKeys.residents.byHouse('h1')],
    ['residents.countByHouse', queryKeys.residents.countByHouse('h1')],
    ['residents.detail', queryKeys.residents.detail('r1')],
    ['houses.all', queryKeys.houses.all],
    ['inventory.catalog', queryKeys.inventory.catalog('h1')],
    ['storeroom.items', queryKeys.storeroom.items('h1')],
    ['storeroom.movements', queryKeys.storeroom.movements('i1')],
    ['supplyRoom.items', queryKeys.supplyRoom.items('h1')],
    ['supplyRoom.movements', queryKeys.supplyRoom.movements('i1')],
    ['incidents.byHouse', queryKeys.incidents.byHouse('h1')],
    ['incidents.todayByHouse', queryKeys.incidents.todayByHouse('h1')],
    ['activities.byHouse', queryKeys.activities.byHouse('h1')],
    ['activities.detail', queryKeys.activities.detail('a1')],
    ['activities.comments', queryKeys.activities.comments('a1')],
    ['streetSales.byHouse', queryKeys.streetSales.byHouse('h1')],
  ])('persiste %s (fluxo de campo)', (_label, key) => {
    expect(shouldDehydrateQuery(query(key))).toBe(true);
  });

  it.each([
    ['messages.conversations', queryKeys.messages.conversations],
    ['messages.thread', queryKeys.messages.thread('r1', 'rel1')],
    ['messages.houseRelatives', queryKeys.messages.houseRelatives('h1')],
    ['notifications.all', queryKeys.notifications.all],
    ['notifications.unreadCount', queryKeys.notifications.unreadCount],
    ['wishlist.items', queryKeys.wishlist.items('r1')],
    ['wishlist.pending', queryKeys.wishlist.pending],
    ['supportGroups.all', queryKeys.supportGroups.all],
    ['bibleCourses.photos', queryKeys.bibleCourses.photos('c1')],
    ['residents.attachments', queryKeys.residents.attachments('r1')],
    ['residents.consents', queryKeys.residents.consents('r1')],
    ['residents.receivables', queryKeys.residents.receivables('r1')],
    ['residents.followUps', queryKeys.residents.followUps('r1')],
    ['relatives.byResident', queryKeys.relatives.byResident('r1')],
    ['ministries.byHouse', queryKeys.ministries.byHouse('h1')],
    ['houses.ministries', queryKeys.houses.ministries('h1')],
    ['events.internal', queryKeys.events.internal],
  ])('NÃO persiste %s (fora da allowlist)', (_label, key) => {
    expect(shouldDehydrateQuery(query(key))).toBe(false);
  });

  it('não persiste query sem sucesso, mesmo em chave da allowlist', () => {
    expect(shouldDehydrateQuery(query(queryKeys.residents.all, 'pending'))).toBe(false);
    expect(shouldDehydrateQuery(query(queryKeys.residents.all, 'error'))).toBe(false);
  });

  it('não persiste chave cujo primeiro segmento não é string', () => {
    expect(shouldDehydrateQuery(query([{ scope: 'residents' }]))).toBe(false);
    expect(shouldDehydrateQuery(query([]))).toBe(false);
  });

  it('dehydrateOptions expõe o mesmo filtro para o PersistQueryClientProvider', () => {
    expect(dehydrateOptions.shouldDehydrateQuery).toBe(shouldDehydrateQuery);
  });
});

describe('clearPersistedCache', () => {
  it('remove a chave do cache persistido do AsyncStorage', async () => {
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify({ clientState: { queries: [] } }));
    await AsyncStorage.setItem('token', 'jwt');

    await clearPersistedCache();

    expect(await AsyncStorage.getItem(PERSIST_KEY)).toBeNull();
    // Não é vassoura geral: só o cache do React Query sai daqui.
    expect(await AsyncStorage.getItem('token')).toBe('jwt');
  });

  it('é idempotente quando não há cache gravado', async () => {
    await expect(clearPersistedCache()).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem(PERSIST_KEY)).toBeNull();
  });
});

describe('constantes de persistência', () => {
  it('maxAge e gcTime são 24h (cache de anteontem não reidrata)', () => {
    expect(PERSIST_MAX_AGE).toBe(24 * 60 * 60 * 1000);
    expect(QUERY_GC_TIME).toBe(PERSIST_MAX_AGE);
  });

  it('buster é versionado à mão', () => {
    expect(PERSIST_BUSTER).toMatch(/^v\d+$/);
  });
});
