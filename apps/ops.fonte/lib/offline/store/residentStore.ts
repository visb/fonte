/**
 * Store local dos filhos (story 175) — a fonte de verdade offline do domínio.
 *
 * O React Query continua sendo a camada de fetch/estado de tela; o que o
 * operador lê dentro da casa, sem sinal e sem prazo de validade, sai daqui.
 * O conteúdo vive até **logout / sessão expirada** (`purgeAll`), que é a
 * mitigação LGPD desta story — não há expiração por tempo.
 *
 * As `payload` guardadas são exatamente as formas que os hooks consomem, para
 * que hidratar o cache do React Query seja uma cópia, não uma tradução.
 */
import type {
  ConsentStatus,
  HouseMinistry,
  Resident,
  ResidentAttachment,
  ResidentFollowUp,
  ResidentReceivable,
} from '@fonte/api-client';
import { getResidentStoreDriver } from './driver';
import {
  detailRowId,
  RESIDENT_DETAIL_KINDS,
  STORE_DATA_TABLES,
  syncedAtMetaKey,
  type ResidentDetailKind,
  type StoreRecord,
  type StoreTable,
} from './schema';

/** Corpo + quando ele foi gravado (alimenta o `dataUpdatedAt` do React Query). */
export interface StoredEntry<T> {
  data: T;
  updatedAt: number;
}

/** Forma de cada bloco de detalhe — a mesma que o hook correspondente devolve. */
export interface ResidentDetailPayloads {
  follow_ups: ResidentFollowUp[];
  attachments: ResidentAttachment[];
  consents: ConsentStatus[];
  receivables: ResidentReceivable[];
}

/** Dado completo de uma casa — o que a sincronização completa substitui. */
export interface HouseStoreData {
  residents: Resident[];
  details: {
    residentId: string;
    kind: ResidentDetailKind;
    data: ResidentDetailPayloads[ResidentDetailKind];
  }[];
  ministries: HouseMinistry[];
}

/** Leitura crua do store, usada para hidratar o cache no boot. */
export interface StoreDump {
  houses: { houseId: string; residents: Resident[]; updatedAt: number }[];
  residents: StoredEntry<Resident>[];
  details: {
    residentId: string;
    kind: ResidentDetailKind;
    data: ResidentDetailPayloads[ResidentDetailKind];
    updatedAt: number;
  }[];
  ministries: { houseId: string; data: HouseMinistry[]; updatedAt: number }[];
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Avisa a UI que o store mudou (o "atualizado em" das telas montadas). */
export function subscribeResidentStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function parse<T>(record: StoreRecord | null): StoredEntry<T> | null {
  if (!record) return null;
  try {
    return { data: JSON.parse(record.payload) as T, updatedAt: record.updatedAt };
  } catch {
    // Linha corrompida é tratada como ausente: o snapshot da casa reconstrói.
    return null;
  }
}

function record(id: string, houseId: string | null, data: unknown): StoreRecord {
  return { id, houseId, payload: JSON.stringify(data), updatedAt: Date.now() };
}

/**
 * Grava só quando o corpo mudou. Regravar payload idêntico a cada refetch
 * (o operador abre a mesma ficha dez vezes) queimaria disco à toa; o carimbo de
 * frescor da tela vem do `lastSyncedAt`, não deste `updated_at`.
 */
async function putIfChanged(
  table: StoreTable,
  id: string,
  houseId: string | null,
  data: unknown,
): Promise<void> {
  const driver = getResidentStoreDriver();
  const next = record(id, houseId, data);
  const existing = await driver.get(table, id);
  if (existing && existing.payload === next.payload && existing.houseId === houseId) return;
  await driver.putMany(table, [next]);
  notify();
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

/**
 * Lista de filhos da casa. A lista é a verdade sobre **quem está na casa**:
 * filho que sumiu dela sai do aparelho junto com a ficha (LGPD — nada de dado
 * pessoal órfão sobrevivendo à transferência).
 */
export async function saveResidentList(houseId: string, residents: Resident[]): Promise<void> {
  const driver = getResidentStoreDriver();
  const stored = await driver.listByHouse('residents', houseId);
  const incoming = new Set(residents.map((resident) => resident.id));
  const gone = stored.filter((row) => !incoming.has(row.id)).map((row) => row.id);

  if (gone.length) await removeResidents(gone);
  for (const resident of residents) {
    await putIfChanged('residents', resident.id, resident.houseId ?? houseId, resident);
  }
  notify();
}

/** Ficha básica de um filho (`residents.detail`). */
export async function saveResident(resident: Resident): Promise<void> {
  await putIfChanged('residents', resident.id, resident.houseId ?? null, resident);
}

export async function saveResidentDetail<K extends ResidentDetailKind>(
  residentId: string,
  kind: K,
  data: ResidentDetailPayloads[K],
): Promise<void> {
  await putIfChanged('resident_details', detailRowId(residentId, kind), null, data);
}

export async function saveHouseMinistries(
  houseId: string,
  ministries: HouseMinistry[],
): Promise<void> {
  await putIfChanged('house_ministries', houseId, houseId, ministries);
}

/** Remove filhos e **toda** a ficha deles (os quatro blocos de detalhe). */
export async function removeResidents(residentIds: string[]): Promise<void> {
  if (!residentIds.length) return;
  const driver = getResidentStoreDriver();
  await driver.remove('residents', residentIds);
  await driver.remove(
    'resident_details',
    residentIds.flatMap((id) => RESIDENT_DETAIL_KINDS.map((kind) => detailRowId(id, kind))),
  );
  notify();
}

/**
 * Remove itens *dentro* dos blocos de detalhe (o `deleted` do snapshot manda
 * ids de acompanhamento e de parcela, não de filho).
 */
export async function removeDetailItems(
  kind: ResidentDetailKind,
  itemIds: string[],
): Promise<void> {
  if (!itemIds.length) return;
  const driver = getResidentStoreDriver();
  const doomed = new Set(itemIds);
  const rows = await driver.listAll('resident_details');
  const suffix = `:${kind}`;

  for (const row of rows) {
    if (!row.id.endsWith(suffix)) continue;
    const entry = parse<{ id: string }[]>(row);
    if (!entry) continue;
    const kept = entry.data.filter((item) => !doomed.has(item.id));
    if (kept.length === entry.data.length) continue;
    await driver.putMany('resident_details', [
      { ...row, payload: JSON.stringify(kept), updatedAt: Date.now() },
    ]);
  }
  notify();
}

/**
 * Sincronização completa (`full: true` da story 177): o snapshot é o
 * reconciliador, então o conteúdo anterior é **substituído**, não mesclado.
 * Limpa tudo (inclusive dado de outra casa, se o operador foi transferido) e
 * regrava. O `meta` sobrevive — o `since` é gravado logo depois.
 */
export async function replaceHouseData(houseId: string, data: HouseStoreData): Promise<void> {
  const driver = getResidentStoreDriver();
  await driver.clear(STORE_DATA_TABLES);
  await driver.putMany(
    'residents',
    data.residents.map((resident) => record(resident.id, resident.houseId ?? houseId, resident)),
  );
  await driver.putMany(
    'resident_details',
    data.details.map((detail) => record(detailRowId(detail.residentId, detail.kind), null, detail.data)),
  );
  await driver.putMany('house_ministries', [record(houseId, houseId, data.ministries)]);
  notify();
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

export async function readResidentList(houseId: string): Promise<StoredEntry<Resident[]> | null> {
  const rows = await getResidentStoreDriver().listByHouse('residents', houseId);
  if (!rows.length) return null;

  const entries = rows
    .map((row) => parse<Resident>(row))
    .filter((entry): entry is StoredEntry<Resident> => entry !== null);
  if (!entries.length) return null;

  return {
    data: entries.map((entry) => entry.data).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    updatedAt: Math.max(...entries.map((entry) => entry.updatedAt)),
  };
}

export async function readResident(residentId: string): Promise<StoredEntry<Resident> | null> {
  return parse<Resident>(await getResidentStoreDriver().get('residents', residentId));
}

export async function readResidentDetail<K extends ResidentDetailKind>(
  residentId: string,
  kind: K,
): Promise<StoredEntry<ResidentDetailPayloads[K]> | null> {
  const row = await getResidentStoreDriver().get('resident_details', detailRowId(residentId, kind));
  return parse<ResidentDetailPayloads[K]>(row);
}

export async function readHouseMinistries(
  houseId: string,
): Promise<StoredEntry<HouseMinistry[]> | null> {
  return parse<HouseMinistry[]>(await getResidentStoreDriver().get('house_ministries', houseId));
}

/** Tudo que está no aparelho, para hidratar o cache do React Query no boot. */
export async function readStoreDump(): Promise<StoreDump> {
  const driver = getResidentStoreDriver();
  const [residentRows, detailRows, ministryRows] = await Promise.all([
    driver.listAll('residents'),
    driver.listAll('resident_details'),
    driver.listAll('house_ministries'),
  ]);

  const residents = residentRows
    .map((row) => parse<Resident>(row))
    .filter((entry): entry is StoredEntry<Resident> => entry !== null);

  const byHouse = new Map<string, { residents: Resident[]; updatedAt: number }>();
  for (const row of residentRows) {
    const entry = parse<Resident>(row);
    if (!entry || !row.houseId) continue;
    const house = byHouse.get(row.houseId) ?? { residents: [], updatedAt: 0 };
    house.residents.push(entry.data);
    house.updatedAt = Math.max(house.updatedAt, entry.updatedAt);
    byHouse.set(row.houseId, house);
  }

  const details = detailRows.flatMap((row) => {
    const [residentId, kind] = splitDetailRowId(row.id);
    if (!kind) return [];
    const entry = parse<ResidentDetailPayloads[ResidentDetailKind]>(row);
    return entry ? [{ residentId, kind, data: entry.data, updatedAt: entry.updatedAt }] : [];
  });

  const ministries = ministryRows.flatMap((row) => {
    const entry = parse<HouseMinistry[]>(row);
    return entry ? [{ houseId: row.id, data: entry.data, updatedAt: entry.updatedAt }] : [];
  });

  return {
    houses: [...byHouse.entries()].map(([houseId, house]) => ({
      houseId,
      residents: [...house.residents].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      updatedAt: house.updatedAt,
    })),
    residents,
    details,
    ministries,
  };
}

function splitDetailRowId(id: string): [string, ResidentDetailKind | null] {
  const separator = id.lastIndexOf(':');
  if (separator < 0) return [id, null];
  const kind = id.slice(separator + 1) as ResidentDetailKind;
  if (!RESIDENT_DETAIL_KINDS.includes(kind)) return [id, null];
  return [id.slice(0, separator), kind];
}

// ─── Carimbo de sincronização ─────────────────────────────────────────────────

/**
 * `syncedAt` da última sincronização bem-sucedida da casa — sempre o relógio do
 * **servidor** (story 177). É o `since` do próximo delta e o que a tela mostra
 * como "atualizado em".
 */
export async function lastSyncedAt(houseId: string): Promise<string | null> {
  const row = await getResidentStoreDriver().get('meta', syncedAtMetaKey(houseId));
  return row ? row.payload : null;
}

export async function setLastSyncedAt(houseId: string, syncedAt: string): Promise<void> {
  await getResidentStoreDriver().putMany('meta', [
    { id: syncedAtMetaKey(houseId), houseId, payload: syncedAt, updatedAt: Date.now() },
  ]);
  notify();
}

// ─── Purga (LGPD) ─────────────────────────────────────────────────────────────

/**
 * Fim de sessão = fim do dado no aparelho. Erro do driver **propaga**: purga que
 * falha em silêncio deixaria ficha de filho no dispositivo de quem saiu.
 */
export async function purgeAll(): Promise<void> {
  await getResidentStoreDriver().clearAll();
  notify();
}
