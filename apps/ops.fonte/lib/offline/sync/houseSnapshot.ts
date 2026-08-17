/**
 * Sincronização do pacote offline da casa (story 175 sobre o endpoint da 177).
 *
 * Um request — `GET /houses/:id/offline-snapshot?since=` — traz a casa inteira
 * (filhos presentes, acompanhamentos, consentimentos, anexos, carnê e
 * ministérios) ou só o que mudou. Substitui o fan-out de `1 + N×4` que uma casa
 * de 40 filhos transformava em ~200 requests **a cada volta do foreground**.
 *
 * Regras do contrato que este módulo respeita:
 * - `full: true` → o conteúdo do store é **substituído** (o snapshot é o
 *   reconciliador); `full: false` → merge por id de cada bloco.
 * - `syncedAt` é o relógio do **servidor** e é o que vira o próximo `since` —
 *   nunca o relógio do aparelho, que em campo pode estar adiantado ou zerado.
 * - `deleted` remove do aparelho (inclui filho que deixou de ser presente).
 * - Erro de rede **não** é falha: o `since` não avança e o store continua
 *   servindo o que já tem.
 */
import type { QueryClient } from '@tanstack/react-query';
import type {
  ConsentRecord,
  HouseOfflineSnapshotResponse,
  Resident,
  ResidentAttachment,
  ResidentFollowUp,
  ResidentReceivable,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { hydrateResidentQueries } from '../store/hydrate';
import {
  lastSyncedAt,
  readResidentDetail,
  removeDetailItems,
  removeResidents,
  replaceHouseData,
  saveHouseMinistries,
  saveResident,
  saveResidentDetail,
  setLastSyncedAt,
  type HouseStoreData,
} from '../store/residentStore';
import { mergeConsentStatuses } from './consents';

export interface HouseSnapshotResult {
  syncedAt: string;
  full: boolean;
}

interface Identified {
  id: string;
}

/** Merge por id: o que veio no delta vence, o que não veio continua valendo. */
function mergeById<T extends Identified>(stored: T[], incoming: T[]): T[] {
  const byId = new Map(stored.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}

/** Mesma ordem do endpoint (`date DESC, created_at DESC`). */
function sortFollowUps(items: ResidentFollowUp[]): ResidentFollowUp[] {
  return [...items].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** Mesma ordem do endpoint (`reference_month ASC`). */
function sortReceivables(items: ResidentReceivable[]): ResidentReceivable[] {
  return [...items].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
}

function buildFullHouseData(
  snapshot: HouseOfflineSnapshotResponse,
): HouseStoreData {
  const details: HouseStoreData['details'] = [];

  for (const resident of snapshot.residents as Resident[]) {
    const id = resident.id;
    details.push({
      residentId: id,
      kind: 'follow_ups',
      data: sortFollowUps(snapshot.followUps[id] ?? []),
    });
    details.push({
      residentId: id,
      kind: 'attachments',
      data: (snapshot.attachments[id] ?? []) as ResidentAttachment[],
    });
    details.push({
      residentId: id,
      kind: 'consents',
      data: mergeConsentStatuses(null, (snapshot.consents[id] ?? []) as ConsentRecord[]),
    });
    // O bloco traz o RECORTE do carnê (story 186: mês + status, sem valor nem
    // pagamento) e desce para toda role de staff. Bloco ausente continua **não**
    // sendo "carnê vazio": só grava quem realmente veio no pacote — assim a tela
    // continua buscando na rede em vez de mostrar um carnê que ninguém enviou.
    const receivables = snapshot.receivables[id];
    if (receivables) {
      details.push({
        residentId: id,
        kind: 'receivables',
        data: sortReceivables(receivables as ResidentReceivable[]),
      });
    }
  }

  return { residents: snapshot.residents as Resident[], details, ministries: snapshot.ministries };
}

async function applyDelta(
  houseId: string,
  snapshot: HouseOfflineSnapshotResponse,
): Promise<void> {
  for (const resident of snapshot.residents as Resident[]) {
    await saveResident({ ...resident, houseId: resident.houseId ?? houseId });
  }

  for (const [residentId, followUps] of Object.entries(snapshot.followUps)) {
    const stored = await readResidentDetail(residentId, 'follow_ups');
    await saveResidentDetail(
      residentId,
      'follow_ups',
      sortFollowUps(mergeById(stored?.data ?? [], followUps as ResidentFollowUp[])),
    );
  }

  for (const [residentId, records] of Object.entries(snapshot.consents)) {
    const stored = await readResidentDetail(residentId, 'consents');
    await saveResidentDetail(
      residentId,
      'consents',
      mergeConsentStatuses(stored?.data ?? null, records as ConsentRecord[]),
    );
  }

  for (const [residentId, receivables] of Object.entries(snapshot.receivables)) {
    const stored = await readResidentDetail(residentId, 'receivables');
    await saveResidentDetail(
      residentId,
      'receivables',
      sortReceivables(mergeById(stored?.data ?? [], receivables as ResidentReceivable[])),
    );
  }

  // Anexo não tem `updated_at` no backend: o bloco vem completo para os filhos
  // que aparecem no delta, então aqui é substituição, não merge.
  for (const [residentId, attachments] of Object.entries(snapshot.attachments)) {
    await saveResidentDetail(residentId, 'attachments', attachments as ResidentAttachment[]);
  }

  if (snapshot.ministries.length) {
    await saveHouseMinistries(houseId, snapshot.ministries);
  }

  await removeResidents(snapshot.deleted.residents);
  await removeDetailItems('follow_ups', snapshot.deleted.followUps);
  await removeDetailItems('receivables', snapshot.deleted.receivables);
}

/**
 * Aplica o pacote no store e semeia o cache do React Query com o resultado —
 * a tela montada reflete na hora, sem esperar refetch.
 */
export async function applyHouseSnapshot(
  queryClient: QueryClient,
  houseId: string,
  snapshot: HouseOfflineSnapshotResponse,
): Promise<void> {
  if (snapshot.full) {
    await replaceHouseData(houseId, buildFullHouseData(snapshot));
  } else {
    await applyDelta(houseId, snapshot);
  }

  await hydrateResidentQueries(queryClient);
}

/**
 * Puxa e aplica o pacote da casa. Devolve `null` quando não houve resposta
 * (sem rede, backend fora, 403) — nesse caso o `since` **não** avança e nada é
 * apagado: o aparelho continua com o que tinha.
 */
export async function syncHouseSnapshot(
  queryClient: QueryClient,
  houseId: string | null | undefined,
): Promise<HouseSnapshotResult | null> {
  if (!houseId) return null;

  let snapshot: HouseOfflineSnapshotResponse;
  try {
    const since = await lastSyncedAt(houseId);
    snapshot = await api.offlineSync.houseSnapshot(houseId, since ?? undefined);
  } catch {
    return null;
  }

  await applyHouseSnapshot(queryClient, houseId, snapshot);
  // Carimbo do servidor, sempre — `Date.now()` do aparelho reabriria o buraco
  // que o `since` fecha.
  await setLastSyncedAt(houseId, snapshot.syncedAt);

  return { syncedAt: snapshot.syncedAt, full: snapshot.full };
}
