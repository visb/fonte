/**
 * Driver nativo do store local (story 175): SQLite via `expo-sqlite`.
 *
 * Uma linha por registro, `user_version` como versão do esquema. É o driver que
 * roda no aparelho do operador; o `driver.asyncStorage` existe para o mesmo app rodar em
 * navegador (e para o Playwright provar o ciclo offline). A bateria de contrato
 * (`driver.test.ts`) roda contra os dois.
 */
import * as SQLite from 'expo-sqlite';
import { migrateStore } from './migrations';
import {
  createTableSql,
  dropTableSql,
  STORE_DB_NAME,
  STORE_TABLES,
  type StoreRecord,
  type StoreTable,
} from './schema';
import type { ResidentStoreDriver } from './driver';

interface Row {
  id: string;
  house_id: string | null;
  payload: string;
  updated_at: number;
}

function toRecord(row: Row): StoreRecord {
  return {
    id: row.id,
    houseId: row.house_id,
    payload: row.payload,
    updatedAt: row.updated_at,
  };
}

const SELECT = 'SELECT id, house_id, payload, updated_at FROM';

export function createSqliteDriver(dbName: string = STORE_DB_NAME): ResidentStoreDriver {
  let ready: Promise<SQLite.SQLiteDatabase> | null = null;

  async function open(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(dbName);
    await migrateStore({
      readVersion: async () => {
        const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        return row?.user_version ?? 0;
      },
      writeVersion: async (version) => {
        await db.execAsync(`PRAGMA user_version = ${version}`);
      },
      dropAll: async () => {
        for (const table of STORE_TABLES) await db.execAsync(dropTableSql(table));
      },
      createAll: async () => {
        for (const table of STORE_TABLES) await db.execAsync(createTableSql(table));
      },
    });
    return db;
  }

  const driver: ResidentStoreDriver = {
    async init() {
      ready ??= open();
      await ready;
    },

    async get(table, id) {
      await driver.init();
      const db = await ready!;
      const row = await db.getFirstAsync<Row>(`${SELECT} ${table} WHERE id = ?`, [id]);
      return row ? toRecord(row) : null;
    },

    async listAll(table) {
      await driver.init();
      const db = await ready!;
      const rows = await db.getAllAsync<Row>(`${SELECT} ${table}`);
      return rows.map(toRecord);
    },

    async listByHouse(table, houseId) {
      await driver.init();
      const db = await ready!;
      const rows = await db.getAllAsync<Row>(`${SELECT} ${table} WHERE house_id = ?`, [houseId]);
      return rows.map(toRecord);
    },

    async putMany(table, records) {
      await driver.init();
      if (!records.length) return;
      const db = await ready!;
      // Upsert por id: regravar o mesmo filho atualiza a linha, não duplica.
      for (const record of records) {
        await db.runAsync(
          `INSERT INTO ${table} (id, house_id, payload, updated_at) VALUES (?, ?, ?, ?) ` +
            'ON CONFLICT(id) DO UPDATE SET house_id = excluded.house_id, ' +
            'payload = excluded.payload, updated_at = excluded.updated_at',
          [record.id, record.houseId, record.payload, record.updatedAt],
        );
      }
    },

    async remove(table, ids) {
      await driver.init();
      if (!ids.length) return;
      const db = await ready!;
      const placeholders = ids.map(() => '?').join(', ');
      await db.runAsync(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
    },

    async clear(tables) {
      await driver.init();
      const db = await ready!;
      for (const table of tables) await db.runAsync(`DELETE FROM ${table}`);
    },

    async clearAll() {
      await driver.clear([...STORE_TABLES]);
    },
  };

  return driver;
}
