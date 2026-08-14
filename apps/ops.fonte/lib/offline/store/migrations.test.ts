import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-sqlite', () => require('@/lib/test/__mocks__/expoSqlite'));

import { __fakeDatabase, __resetFakeSqlite } from '@/lib/test/__mocks__/expoSqlite';
import { migrateStore, type VersionedStore } from './migrations';
import { createSqliteDriver } from './driver.sqlite';
import { createWebDriver } from './driver.asyncStorage';
import { STORE_VERSION, STORE_WEB_PREFIX } from './schema';

function spyStore(version: number): { store: VersionedStore; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    store: {
      readVersion: async () => version,
      writeVersion: async (next) => {
        calls.push(`write:${next}`);
      },
      dropAll: async () => {
        calls.push('drop');
      },
      createAll: async () => {
        calls.push('create');
      },
    },
  };
}

describe('migrateStore', () => {
  it('versão igual: só garante as estruturas, sem descartar dado', async () => {
    const { store, calls } = spyStore(STORE_VERSION);

    await migrateStore(store);

    expect(calls).toEqual(['create']);
  });

  it('versão diferente: descarta, recria e carimba a nova versão', async () => {
    const { store, calls } = spyStore(STORE_VERSION + 1);

    await migrateStore(store);

    expect(calls).toEqual(['drop', 'create', `write:${STORE_VERSION}`]);
  });

  it('store novo (versão 0) nasce vazio e versionado', async () => {
    const { store, calls } = spyStore(0);

    await migrateStore(store);

    expect(calls).toEqual(['drop', 'create', `write:${STORE_VERSION}`]);
  });
});

describe('versionamento no driver SQLite', () => {
  beforeEach(() => __resetFakeSqlite());

  it('mesma versão preserva o que estava gravado', async () => {
    const first = createSqliteDriver('version-test.db');
    await first.putMany('residents', [{ id: 'r1', houseId: 'h1', payload: '{}', updatedAt: 1 }]);

    const second = createSqliteDriver('version-test.db');
    await second.init();

    expect(await second.get('residents', 'r1')).not.toBeNull();
    expect(__fakeDatabase('version-test.db')?.userVersion).toBe(STORE_VERSION);
  });

  it('esquema de outra versão é descartado e recriado vazio', async () => {
    const first = createSqliteDriver('version-test.db');
    await first.putMany('residents', [{ id: 'r1', houseId: 'h1', payload: '{}', updatedAt: 1 }]);

    // Deploy anterior com outro formato de payload.
    __fakeDatabase('version-test.db')!.userVersion = STORE_VERSION + 7;

    const second = createSqliteDriver('version-test.db');
    await second.init();

    expect(await second.get('residents', 'r1')).toBeNull();
    expect(__fakeDatabase('version-test.db')?.userVersion).toBe(STORE_VERSION);
  });
});

describe('versionamento no driver web', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('mesma versão preserva o que estava gravado', async () => {
    const first = createWebDriver();
    await first.putMany('residents', [{ id: 'r1', houseId: 'h1', payload: '{}', updatedAt: 1 }]);

    const second = createWebDriver();
    await second.init();

    expect(await second.get('residents', 'r1')).not.toBeNull();
    expect(await AsyncStorage.getItem(`${STORE_WEB_PREFIX}version`)).toBe(String(STORE_VERSION));
  });

  it('esquema de outra versão é descartado e recriado vazio', async () => {
    const first = createWebDriver();
    await first.putMany('residents', [{ id: 'r1', houseId: 'h1', payload: '{}', updatedAt: 1 }]);

    await AsyncStorage.setItem(`${STORE_WEB_PREFIX}version`, String(STORE_VERSION + 7));

    const second = createWebDriver();
    await second.init();

    expect(await second.get('residents', 'r1')).toBeNull();
    expect(await AsyncStorage.getItem(`${STORE_WEB_PREFIX}version`)).toBe(String(STORE_VERSION));
  });
});
