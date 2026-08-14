/**
 * Driver web do store local (story 175): AsyncStorage com **uma chave por
 * registro** (no navegador, `localStorage`).
 *
 * Uma chave por registro — e não um blob — é o ponto: é o que evita reserializar
 * a casa inteira a cada gravação, que é o defeito do persister do React Query
 * para este domínio.
 *
 * O nome do arquivo **não** é `driver.web.ts` de propósito: `.web` é extensão de
 * plataforma do Metro e, no bundle web, `./driver` (a seleção de driver)
 * resolveria para este arquivo em vez do módulo certo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateStore } from './migrations';
import {
  STORE_TABLES,
  STORE_WEB_PREFIX,
  type StoreRecord,
  type StoreTable,
} from './schema';
import type { ResidentStoreDriver } from './driver';

const VERSION_KEY = `${STORE_WEB_PREFIX}version`;

function rowKey(table: StoreTable, id: string): string {
  return `${STORE_WEB_PREFIX}${table}:${id}`;
}

function tablePrefix(table: StoreTable): string {
  return `${STORE_WEB_PREFIX}${table}:`;
}

interface StoredRow {
  houseId: string | null;
  payload: string;
  updatedAt: number;
}

function decode(id: string, raw: string | null): StoreRecord | null {
  if (!raw) return null;
  try {
    const row = JSON.parse(raw) as StoredRow;
    return { id, houseId: row.houseId ?? null, payload: row.payload, updatedAt: row.updatedAt };
  } catch {
    // Registro corrompido é tratado como ausente: o snapshot da casa reconstrói.
    return null;
  }
}

export function createWebDriver(): ResidentStoreDriver {
  let ready: Promise<void> | null = null;

  async function keysOf(table: StoreTable): Promise<string[]> {
    const prefix = tablePrefix(table);
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((key) => key.startsWith(prefix));
  }

  const driver: ResidentStoreDriver = {
    init() {
      ready ??= migrateStore({
        readVersion: async () => Number((await AsyncStorage.getItem(VERSION_KEY)) ?? 0),
        writeVersion: async (version) => AsyncStorage.setItem(VERSION_KEY, String(version)),
        dropAll: async () => {
          const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
            key.startsWith(STORE_WEB_PREFIX),
          );
          if (keys.length) await AsyncStorage.multiRemove(keys);
        },
        // Sem DDL no web: a "tabela" é o prefixo da chave.
        createAll: async () => {},
      });
      return ready;
    },

    async get(table, id) {
      await driver.init();
      return decode(id, await AsyncStorage.getItem(rowKey(table, id)));
    },

    async listAll(table) {
      await driver.init();
      const keys = await keysOf(table);
      if (!keys.length) return [];
      const prefix = tablePrefix(table);
      const entries = await AsyncStorage.multiGet(keys);
      return entries
        .map(([key, raw]) => decode(key.slice(prefix.length), raw))
        .filter((record): record is StoreRecord => record !== null);
    },

    async listByHouse(table, houseId) {
      const records = await driver.listAll(table);
      return records.filter((record) => record.houseId === houseId);
    },

    async putMany(table, records) {
      await driver.init();
      if (!records.length) return;
      await AsyncStorage.multiSet(
        records.map((record) => [
          rowKey(table, record.id),
          JSON.stringify({
            houseId: record.houseId,
            payload: record.payload,
            updatedAt: record.updatedAt,
          } satisfies StoredRow),
        ]),
      );
    },

    async remove(table, ids) {
      await driver.init();
      if (!ids.length) return;
      await AsyncStorage.multiRemove(ids.map((id) => rowKey(table, id)));
    },

    async clear(tables) {
      await driver.init();
      const keys = (await Promise.all(tables.map(keysOf))).flat();
      if (keys.length) await AsyncStorage.multiRemove(keys);
    },

    async clearAll() {
      await driver.init();
      await driver.clear([...STORE_TABLES]);
    },
  };

  return driver;
}
