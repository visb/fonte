/**
 * Write-through do domínio de filho: query que volta da rede com sucesso cai no
 * store local (story 175).
 *
 * Fica num assinante único do `QueryCache` em vez de espalhado por seis hooks:
 * a assinatura pública dos hooks não muda, não há chance de um deles esquecer de
 * gravar, e a regra de "o que é dado de filho" mora num lugar só — ao lado da
 * allowlist LGPD que decide o que pode ir para o disco.
 *
 * A hidratação (`hydrate.ts`) usa `setQueryData`, que o React Query marca como
 * `manual`: sem esse filtro o store se regravaria em loop com o que ele mesmo
 * acabou de servir.
 */
import type { QueryClient } from '@tanstack/react-query';
import type {
  ConsentStatus,
  HouseMinistry,
  Resident,
  ResidentAttachment,
  ResidentFollowUp,
  ResidentReceivable,
} from '@fonte/api-client';
import {
  saveHouseMinistries,
  saveResident,
  saveResidentDetail,
  saveResidentList,
} from './residentStore';
import type { ResidentDetailKind } from './schema';

export type WriteTarget =
  | { table: 'list'; houseId: string }
  | { table: 'resident'; residentId: string }
  | { table: 'detail'; residentId: string; kind: ResidentDetailKind }
  | { table: 'ministries'; houseId: string };

const DETAIL_BY_RESOURCE: Record<string, ResidentDetailKind> = {
  'resident-follow-ups': 'follow_ups',
  'resident-attachments': 'attachments',
  'resident-consents': 'consents',
  'resident-receivables': 'receivables',
};

/**
 * Query key → destino no store. Chave fora do domínio de filho devolve `null`
 * (nada entra no store por omissão — é allowlist, como o persister).
 */
export function residentStoreWriteTarget(queryKey: readonly unknown[]): WriteTarget | null {
  const [resource, id] = queryKey;
  if (typeof resource !== 'string' || typeof id !== 'string' || !id) return null;

  if (resource === 'residents' || resource === 'residents-count') {
    return { table: 'list', houseId: id };
  }
  if (resource === 'resident') return { table: 'resident', residentId: id };
  if (resource === 'house-ministries') return { table: 'ministries', houseId: id };

  const kind = DETAIL_BY_RESOURCE[resource];
  return kind ? { table: 'detail', residentId: id, kind } : null;
}

/** Grava no store o resultado de uma query do domínio de filho. */
export async function writeQueryThrough(
  queryKey: readonly unknown[],
  data: unknown,
): Promise<void> {
  const target = residentStoreWriteTarget(queryKey);
  if (!target || data === undefined || data === null) return;

  switch (target.table) {
    case 'list':
      if (Array.isArray(data)) await saveResidentList(target.houseId, data as Resident[]);
      return;
    case 'resident':
      await saveResident(data as Resident);
      return;
    case 'ministries':
      if (Array.isArray(data)) await saveHouseMinistries(target.houseId, data as HouseMinistry[]);
      return;
    case 'detail':
      if (!Array.isArray(data)) return;
      await saveResidentDetail(
        target.residentId,
        target.kind,
        data as ResidentFollowUp[] & ResidentAttachment[] & ConsentStatus[] & ResidentReceivable[],
      );
  }
}

/**
 * Liga o write-through ao cache. Devolve o cancelador (o app liga uma vez no
 * boot; o teste liga e desliga).
 */
export function attachResidentStoreWriteThrough(queryClient: QueryClient): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    const action = event.action as { type: string; data?: unknown; manual?: boolean };
    if (action.type !== 'success' || action.manual) return;

    // Falha de gravação não pode derrubar a tela: o próximo snapshot da casa
    // reescreve o bloco inteiro.
    void writeQueryThrough(event.query.queryKey, action.data).catch(() => {});
  });
}
