/**
 * Interface de persistência do store local (story 175).
 *
 * Dois drivers com **semântica idêntica**: SQLite (`expo-sqlite`) no aparelho e
 * AsyncStorage (uma chave por registro) no web. O ops.fonte roda em web — é lá
 * que o Playwright prova o comportamento offline (o Maestro não controla rede) —,
 * então a mesma bateria de contrato roda contra os dois (`driver.test.ts`).
 *
 * A interface é deliberadamente burra (linhas indexadas por id/casa): toda a
 * regra de domínio mora em `residentStore.ts`.
 */
import { Platform } from 'react-native';
import type { StoreRecord, StoreTable } from './schema';

export interface ResidentStoreDriver {
  /** Abre e versiona o store. Idempotente — pode ser chamado antes de cada operação. */
  init(): Promise<void>;
  get(table: StoreTable, id: string): Promise<StoreRecord | null>;
  listByHouse(table: StoreTable, houseId: string): Promise<StoreRecord[]>;
  listAll(table: StoreTable): Promise<StoreRecord[]>;
  putMany(table: StoreTable, records: StoreRecord[]): Promise<void>;
  remove(table: StoreTable, ids: string[]): Promise<void>;
  /** Esvazia as tabelas de dado (mantém o store criado). */
  clear(tables: StoreTable[]): Promise<void>;
  /** Purga LGPD: nada sobrevive, nem o carimbo de sincronização. */
  clearAll(): Promise<void>;
}

let driver: ResidentStoreDriver | null = null;

/**
 * Driver do ambiente corrente. O módulo do SQLite é carregado **sob demanda**:
 * no bundle web ele nunca é avaliado (o navegador não tem o módulo nativo).
 *
 * O driver de AsyncStorage **não** pode se chamar `driver.web.ts`: `.web` é
 * extensão de plataforma do Metro, e no bundle web `./driver` resolveria para
 * ele — este arquivo sumiria do bundle junto com a seleção de driver.
 */
export function createResidentStoreDriver(): ResidentStoreDriver {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWebDriver } =
      require('./driver.asyncStorage') as typeof import('./driver.asyncStorage');
    return createWebDriver();
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createSqliteDriver } = require('./driver.sqlite') as typeof import('./driver.sqlite');
  return createSqliteDriver();
}

/** Singleton do app. */
export function getResidentStoreDriver(): ResidentStoreDriver {
  driver ??= createResidentStoreDriver();
  return driver;
}

/**
 * Troca o driver (testes e a bateria de contrato). `null` volta ao padrão da
 * plataforma.
 */
export function setResidentStoreDriver(next: ResidentStoreDriver | null): void {
  driver = next;
}
