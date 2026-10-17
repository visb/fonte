/**
 * Pré-aquecimento do cache da casa do operador (story 171, decisão 3).
 *
 * "Offline-first" só vale para quem abriu a tela **antes** de perder o sinal: o
 * operador que entra na casa e só então abre a contagem não tem nada em cache.
 * Aqui o app puxa, no login e ao voltar do background, o pacote mínimo que os
 * fluxos de campo consomem — filhos da casa, catálogo de estoque, ocorrências
 * de hoje, atividades e servos da casa.
 *
 * LGPD (decisão 4 do epic 167): tudo que é aquecido **precisa** estar na
 * allowlist de `constants.ts`, senão o dado ficaria em memória por nada. O
 * `prefetch.test.ts` trava isso.
 */
import { AppState } from 'react-native';
import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { queryClient as defaultQueryClient } from '@/lib/queryClient';
import { isPersistableQueryKey } from './constants';
import { syncHouseSnapshot } from './sync/houseSnapshot';

/**
 * Janela em que um aquecimento recente é considerado suficiente. Voltar do
 * background dez vezes seguidas não pode virar dez rodadas de rede.
 */
export const WARM_STALE_TIME = 60_000;

interface WarmQuery {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
}

/**
 * Pacote de campo: o que o operador consome dentro da casa, sem sinal.
 *
 * A lista de filhos **não** está aqui desde a story 175: ela (e a ficha inteira
 * de cada filho) vem do snapshot da casa, num request só, para o store local.
 */
function houseQueries(houseId: string): WarmQuery[] {
  return [
    {
      queryKey: queryKeys.storeroom.items(houseId),
      queryFn: () => api.storeroom.listItems({ houseId }),
    },
    {
      queryKey: queryKeys.supplyRoom.items(houseId),
      queryFn: () => api.supplyRoom.listItems({ houseId }),
    },
    {
      queryKey: queryKeys.incidents.todayByHouse(houseId),
      queryFn: () => api.incidents.list({ houseId }),
    },
    {
      queryKey: queryKeys.activities.byHouse(houseId),
      queryFn: () => api.activities.list(),
    },
    // Story 204: lista *Servos* (e seletor de líder) disponível no primeiro
    // uso sem sinal.
    {
      queryKey: queryKeys.staff.byHouse(houseId),
      queryFn: () => api.houses.listStaff(houseId),
    },
  ];
}

/**
 * Puxa o pacote da casa para o cache. Sem `houseId` (staff de grupo de apoio,
 * interno) não há o que aquecer.
 *
 * Falha de rede aqui **não é erro do app**: o aquecimento é oportunista, o que
 * já estava em cache continua valendo e a tela pede de novo quando abrir.
 */
export async function warmHouseCache(
  queryClient: QueryClient,
  houseId: string | null | undefined,
): Promise<void> {
  if (!houseId) return;

  // `prefetchQuery` nunca rejeita (engole o erro da query, por contrato do React
  // Query): é exatamente o comportamento que se quer aqui.
  await Promise.all([
    warmHouseSnapshot(queryClient, houseId),
    ...houseQueries(houseId).map((query) =>
      queryClient.prefetchQuery({ ...query, staleTime: WARM_STALE_TIME }),
    ),
  ]);
}

/**
 * Ficha dos filhos (story 175): **um** request agregado, não `1 + N×4`.
 *
 * A deduplicação usa o próprio React Query (`staleTime`), guardando só o recibo
 * `{ syncedAt, full }` — voltar do background dez vezes seguidas continua sendo
 * uma sincronização só. A falha já vem tratada de `syncHouseSnapshot` (devolve
 * `null` sem avançar o `since`), então ela não derruba o resto do aquecimento.
 */
function warmHouseSnapshot(queryClient: QueryClient, houseId: string): Promise<unknown> {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.offline.houseSnapshot(houseId),
    queryFn: () => syncHouseSnapshot(queryClient, houseId),
    staleTime: WARM_STALE_TIME,
    gcTime: WARM_STALE_TIME,
  });
}

/** Chaves aquecidas — usado pelo teste que amarra aquecimento e allowlist LGPD. */
export function warmedQueryKeys(houseId: string): readonly unknown[][] {
  return houseQueries(houseId).map((query) => [...query.queryKey]);
}

export function areWarmedKeysPersistable(houseId: string): boolean {
  return warmedQueryKeys(houseId).every(isPersistableQueryKey);
}

/**
 * Aquece na montagem e a cada volta ao primeiro plano — o gatilho natural de
 * "cheguei num lugar com sinal" (o `focusManager` da story 168 revalida o que
 * está montado; isto traz o que ainda nem foi aberto).
 */
export function useWarmHouseCache(
  houseId: string | null | undefined,
  queryClient: QueryClient = defaultQueryClient,
): void {
  useEffect(() => {
    if (!houseId) return;

    void warmHouseCache(queryClient, houseId);

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void warmHouseCache(queryClient, houseId);
    });
    return () => subscription.remove();
  }, [houseId, queryClient]);
}
