/**
 * Versionamento do store local (story 175).
 *
 * O conteúdo do store é cache reconstruível pelo snapshot da casa (story 177):
 * quando a versão do esquema muda, a estratégia é **descartar e recriar**, não
 * migrar conteúdo. Reidratar um formato antigo custaria mais do que baixar o
 * pacote da casa de novo — e reidratar errado mostraria ficha corrompida ao
 * operador.
 */
import { STORE_VERSION } from './schema';

/**
 * O mínimo que um driver precisa expor para ser versionado. Mantém a regra de
 * migração num só lugar, testável sem SQLite e sem AsyncStorage, e idêntica nos
 * dois drivers (é o que faz o e2e web provar o comportamento do nativo).
 */
export interface VersionedStore {
  readVersion(): Promise<number>;
  writeVersion(version: number): Promise<void>;
  /** Apaga tudo (tabelas/chaves) — inclusive `meta`: o `since` do sync some junto. */
  dropAll(): Promise<void>;
  /** Cria as estruturas vazias. */
  createAll(): Promise<void>;
}

/**
 * Garante que o store está na versão corrente:
 * - versão igual → só garante a existência das estruturas (dado preservado);
 * - versão diferente (ou banco novo, versão 0) → descarta e recria vazio.
 */
export async function migrateStore(
  store: VersionedStore,
  targetVersion: number = STORE_VERSION,
): Promise<void> {
  const current = await store.readVersion();

  if (current === targetVersion) {
    await store.createAll();
    return;
  }

  await store.dropAll();
  await store.createAll();
  await store.writeVersion(targetVersion);
}
