/**
 * `expo-sqlite` de mentira para os testes do store local (story 175).
 *
 * O módulo nativo não existe no jest — mas o driver SQLite **precisa** ser
 * exercitado pela mesma bateria de contrato do driver web, senão o e2e web não
 * prova nada sobre o aparelho. Este fake entende exatamente o punhado de
 * statements que `driver.sqlite.ts` emite (o dia em que ele emitir outro, o
 * teste quebra aqui — de propósito).
 */
interface Row {
  id: string;
  house_id: string | null;
  payload: string;
  updated_at: number;
}

class FakeDatabase {
  userVersion = 0;
  tables = new Map<string, Map<string, Row>>();

  private table(name: string): Map<string, Row> {
    const table = this.tables.get(name);
    if (!table) throw new Error(`no such table: ${name}`);
    return table;
  }

  async execAsync(sql: string): Promise<void> {
    const statement = sql.trim();

    const pragma = /^PRAGMA user_version\s*=\s*(\d+)$/i.exec(statement);
    if (pragma) {
      this.userVersion = Number(pragma[1]);
      return;
    }

    const create = /^CREATE TABLE IF NOT EXISTS (\w+)/i.exec(statement);
    if (create) {
      if (!this.tables.has(create[1])) this.tables.set(create[1], new Map());
      return;
    }

    const drop = /^DROP TABLE IF EXISTS (\w+)/i.exec(statement);
    if (drop) {
      this.tables.delete(drop[1]);
      return;
    }

    throw new Error(`fake-sqlite: execAsync não entende "${statement}"`);
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const statement = sql.trim();
    if (/^PRAGMA user_version$/i.test(statement)) {
      return { user_version: this.userVersion } as T;
    }

    const select = /^SELECT .* FROM (\w+) WHERE id = \?$/i.exec(statement);
    if (select) return (this.table(select[1]).get(String(params[0])) ?? null) as T | null;

    throw new Error(`fake-sqlite: getFirstAsync não entende "${statement}"`);
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const statement = sql.trim();

    const byHouse = /^SELECT .* FROM (\w+) WHERE house_id = \?$/i.exec(statement);
    if (byHouse) {
      return [...this.table(byHouse[1]).values()].filter(
        (row) => row.house_id === params[0],
      ) as T[];
    }

    const all = /^SELECT .* FROM (\w+)$/i.exec(statement);
    if (all) return [...this.table(all[1]).values()] as T[];

    throw new Error(`fake-sqlite: getAllAsync não entende "${statement}"`);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    const statement = sql.trim().replace(/\s+/g, ' ');

    const insert = /^INSERT INTO (\w+) \(id, house_id, payload, updated_at\)/i.exec(statement);
    if (insert) {
      const [id, houseId, payload, updatedAt] = params as [string, string | null, string, number];
      // ON CONFLICT(id) DO UPDATE: upsert por id, nunca linha duplicada.
      this.table(insert[1]).set(id, {
        id,
        house_id: houseId ?? null,
        payload,
        updated_at: updatedAt,
      });
      return;
    }

    const deleteIn = /^DELETE FROM (\w+) WHERE id IN \(([?, ]+)\)$/i.exec(statement);
    if (deleteIn) {
      const table = this.table(deleteIn[1]);
      for (const id of params as string[]) table.delete(id);
      return;
    }

    const deleteAll = /^DELETE FROM (\w+)$/i.exec(statement);
    if (deleteAll) {
      this.table(deleteAll[1]).clear();
      return;
    }

    throw new Error(`fake-sqlite: runAsync não entende "${statement}"`);
  }
}

const databases = new Map<string, FakeDatabase>();

export async function openDatabaseAsync(name: string): Promise<FakeDatabase> {
  let db = databases.get(name);
  if (!db) {
    db = new FakeDatabase();
    databases.set(name, db);
  }
  return db;
}

/** Zera o "disco" entre testes. */
export function __resetFakeSqlite(): void {
  databases.clear();
}

/** Acesso ao banco cru — usado para simular versão antiga do esquema. */
export function __fakeDatabase(name: string): FakeDatabase | undefined {
  return databases.get(name);
}
