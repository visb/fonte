/**
 * Bateria de **contrato** dos dois drivers do store local (story 175).
 *
 * O mesmo conjunto de casos roda contra SQLite (aparelho) e AsyncStorage (web).
 * É essa paridade que autoriza o e2e web do Playwright a valer como prova do
 * comportamento offline do app nativo.
 */
import fs from 'fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

jest.mock('expo-sqlite', () => require('@/lib/test/__mocks__/expoSqlite'));

import { __resetFakeSqlite } from '@/lib/test/__mocks__/expoSqlite';
import { createSqliteDriver } from './driver.sqlite';
import { createWebDriver } from './driver.asyncStorage';
import { createResidentStoreDriver, getResidentStoreDriver, setResidentStoreDriver } from './driver';
import type { ResidentStoreDriver } from './driver';
import { STORE_WEB_PREFIX, type StoreRecord } from './schema';

function record(id: string, houseId: string | null, payload: string): StoreRecord {
  return { id, houseId, payload, updatedAt: 1_000 };
}

const drivers: [string, () => ResidentStoreDriver][] = [
  ['sqlite (aparelho)', () => createSqliteDriver('contract-test.db')],
  ['web (AsyncStorage)', () => createWebDriver()],
];

describe.each(drivers)('ResidentStoreDriver — %s', (_label, create) => {
  let driver: ResidentStoreDriver;

  beforeEach(async () => {
    __resetFakeSqlite();
    await AsyncStorage.clear();
    driver = create();
    await driver.init();
  });

  it('grava e lê um registro por id', async () => {
    await driver.putMany('residents', [record('r1', 'h1', '{"name":"João"}')]);

    expect(await driver.get('residents', 'r1')).toEqual({
      id: 'r1',
      houseId: 'h1',
      payload: '{"name":"João"}',
      updatedAt: 1_000,
    });
  });

  it('id inexistente devolve null (não lança)', async () => {
    expect(await driver.get('residents', 'fantasma')).toBeNull();
  });

  it('lista por casa só devolve a casa pedida', async () => {
    await driver.putMany('residents', [
      record('r1', 'h1', '{}'),
      record('r2', 'h2', '{}'),
      record('r3', 'h1', '{}'),
    ]);

    const rows = await driver.listByHouse('residents', 'h1');

    expect(rows.map((row) => row.id).sort()).toEqual(['r1', 'r3']);
    expect(await driver.listByHouse('residents', 'casa-vazia')).toEqual([]);
  });

  it('putMany é idempotente por id: regravar atualiza, não duplica', async () => {
    await driver.putMany('residents', [record('r1', 'h1', '{"v":1}')]);
    await driver.putMany('residents', [{ ...record('r1', 'h1', '{"v":2}'), updatedAt: 2_000 }]);

    const rows = await driver.listAll('residents');
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toBe('{"v":2}');
    expect(rows[0].updatedAt).toBe(2_000);
  });

  it('putMany/remove sem itens é no-op', async () => {
    await expect(driver.putMany('residents', [])).resolves.toBeUndefined();
    await expect(driver.remove('residents', [])).resolves.toBeUndefined();
    expect(await driver.listAll('residents')).toEqual([]);
  });

  it('remove apaga só os ids pedidos', async () => {
    await driver.putMany('residents', [record('r1', 'h1', '{}'), record('r2', 'h1', '{}')]);

    await driver.remove('residents', ['r1']);

    expect(await driver.get('residents', 'r1')).toBeNull();
    expect(await driver.get('residents', 'r2')).not.toBeNull();
  });

  it('clear esvazia as tabelas pedidas e preserva as outras', async () => {
    await driver.putMany('residents', [record('r1', 'h1', '{}')]);
    await driver.putMany('meta', [record('synced-at:h1', 'h1', '2026-08-14T10:00:00.000Z')]);

    await driver.clear(['residents']);

    expect(await driver.listAll('residents')).toEqual([]);
    expect(await driver.get('meta', 'synced-at:h1')).not.toBeNull();
  });

  it('clearAll não deixa nada — nem o carimbo de sincronização (purga LGPD)', async () => {
    await driver.putMany('residents', [record('r1', 'h1', '{}')]);
    await driver.putMany('resident_details', [record('r1:follow_ups', null, '[]')]);
    await driver.putMany('house_ministries', [record('h1', 'h1', '[]')]);
    await driver.putMany('meta', [record('synced-at:h1', 'h1', '2026-08-14T10:00:00.000Z')]);

    await driver.clearAll();

    expect(await driver.listAll('residents')).toEqual([]);
    expect(await driver.listAll('resident_details')).toEqual([]);
    expect(await driver.listAll('house_ministries')).toEqual([]);
    expect(await driver.get('meta', 'synced-at:h1')).toBeNull();
  });

  it('dado sobrevive à reabertura do store (é disco, não memória)', async () => {
    await driver.putMany('residents', [record('r1', 'h1', '{"name":"João"}')]);

    const reopened = create();
    await reopened.init();

    expect(await reopened.get('residents', 'r1')).toMatchObject({ payload: '{"name":"João"}' });
  });

  it('init é idempotente', async () => {
    await driver.putMany('residents', [record('r1', 'h1', '{}')]);
    await driver.init();
    await driver.init();

    expect(await driver.listAll('residents')).toHaveLength(1);
  });
});

describe('driver de AsyncStorage — detalhes da representação', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('grava uma chave por registro (nada de blob reserializado)', async () => {
    const driver = createWebDriver();
    await driver.putMany('residents', [record('r1', 'h1', '{}'), record('r2', 'h1', '{}')]);

    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(`${STORE_WEB_PREFIX}residents:`),
    );

    expect(keys.sort()).toEqual([
      `${STORE_WEB_PREFIX}residents:r1`,
      `${STORE_WEB_PREFIX}residents:r2`,
    ]);
  });

  it('registro corrompido é tratado como ausente (o snapshot reconstrói)', async () => {
    const driver = createWebDriver();
    await driver.init();
    await AsyncStorage.setItem(`${STORE_WEB_PREFIX}residents:r1`, 'não é json');

    expect(await driver.get('residents', 'r1')).toBeNull();
    expect(await driver.listAll('residents')).toEqual([]);
  });
});

describe('seleção de driver', () => {
  const originalOS = Platform.OS;

  beforeEach(async () => {
    __resetFakeSqlite();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    setResidentStoreDriver(null);
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('no aparelho usa SQLite (nada vai para o AsyncStorage)', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

    const driver = createResidentStoreDriver();
    await driver.putMany('residents', [record('r1', 'h1', '{}')]);

    expect(await driver.get('residents', 'r1')).not.toBeNull();
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some((key) => key.startsWith(STORE_WEB_PREFIX))).toBe(false);
  });

  it('em web usa o driver de AsyncStorage', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });

    const driver = createResidentStoreDriver();
    await driver.putMany('residents', [record('r1', 'h1', '{}')]);

    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some((key) => key.startsWith(STORE_WEB_PREFIX))).toBe(true);
  });

  it('nenhum módulo do store usa extensão de plataforma no nome', () => {
    // `foo.web.ts` é extensão de plataforma do Metro: no bundle web `./driver`
    // resolveria para `driver.web.ts` e a seleção de driver acima sumiria do
    // bundle ("getResidentStoreDriver is not a function" só em produção web).
    // O jest resolve como nativo e não veria o problema — daí a trava aqui.
    const files = fs.readdirSync(__dirname);

    expect(files.filter((file) => /\.(web|native|ios|android)\.tsx?$/.test(file))).toEqual([]);
  });

  it('o singleton é reaproveitado e pode ser trocado nos testes', () => {
    const fake = {} as ResidentStoreDriver;
    setResidentStoreDriver(fake);

    expect(getResidentStoreDriver()).toBe(fake);

    setResidentStoreDriver(null);
    expect(getResidentStoreDriver()).toBe(getResidentStoreDriver());
  });
});
