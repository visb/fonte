/**
 * Esquema do store local dos filhos (story 175).
 *
 * O cache do React Query em blob único (`lib/offline/persister.ts`) resolve
 * "abrir com dado", mas expira em 24h e reserializa tudo a cada gravação. A ficha
 * do filho — que o operador precisa ler **dentro da casa, sem sinal, sem prazo** —
 * passa a viver aqui: um banco local por registro, sem expiração, apagado só no
 * logout / sessão expirada (LGPD).
 *
 * O store **não remodela contrato**: `payload` é o JSON do tipo compartilhado
 * (`@fonte/api-client`) exatamente como o React Query o consome. O que o store
 * acrescenta é índice (`id`, `house_id`) e carimbo (`updated_at`).
 */

/** Nome do arquivo SQLite no dispositivo (driver nativo). */
export const STORE_DB_NAME = 'ops-fonte-resident-store.db';

/** Prefixo das chaves do driver web (AsyncStorage = localStorage no navegador). */
export const STORE_WEB_PREFIX = 'ops-fonte-resident-store:';

/**
 * Versão do esquema. Bump **descarta e recria** o banco: o conteúdo é cache
 * reconstruível pelo snapshot da casa (story 177), não há migração de dado a
 * preservar.
 */
export const STORE_VERSION = 1;

/** Tabelas do store. `meta` guarda o carimbo do último sync por casa. */
export const STORE_TABLES = [
  // Adição compatível: criada no boot sem apagar cache/outbox existentes.
  'house_product_contributions',
  'residents',
  'resident_details',
  'house_ministries',
  'meta',
] as const;

export type StoreTable = (typeof STORE_TABLES)[number];

/** Tabelas de dado pessoal — as que a sincronização completa substitui. */
export const STORE_DATA_TABLES: StoreTable[] = [
  'residents',
  'resident_details',
  'house_ministries',
];

/**
 * Blocos de detalhe da ficha. `consents` e `receivables` entraram por decisão
 * explícita do usuário na story 175 (estavam fora da allowlist do epic 167).
 */
export const RESIDENT_DETAIL_KINDS = [
  'follow_ups',
  'attachments',
  'consents',
  'receivables',
] as const;

export type ResidentDetailKind = (typeof RESIDENT_DETAIL_KINDS)[number];

/** Linha do store: índice + corpo serializado. */
export interface StoreRecord {
  id: string;
  houseId: string | null;
  payload: string;
  updatedAt: number;
}

/** Id composto da linha de detalhe (`PK(resident_id, kind)` na prática). */
export function detailRowId(residentId: string, kind: ResidentDetailKind): string {
  return `${residentId}:${kind}`;
}

/** Chave do carimbo de sincronização da casa em `meta`. */
export function syncedAtMetaKey(houseId: string): string {
  return `synced-at:${houseId}`;
}

/**
 * DDL de uma tabela. Todas têm a mesma forma — o que muda é o que a linha
 * representa —, o que mantém o driver SQLite pequeno e o driver web equivalente.
 */
export function createTableSql(table: StoreTable): string {
  return (
    `CREATE TABLE IF NOT EXISTS ${table} (` +
    'id TEXT PRIMARY KEY NOT NULL, ' +
    'house_id TEXT, ' +
    'payload TEXT NOT NULL, ' +
    'updated_at INTEGER NOT NULL)'
  );
}

export function dropTableSql(table: StoreTable): string {
  return `DROP TABLE IF EXISTS ${table}`;
}
