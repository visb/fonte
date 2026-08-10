import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Mutation, Query } from '@tanstack/react-query';
import {
  isPersistableQueryKey,
  PERSIST_KEY,
  PERSIST_THROTTLE_TIME,
} from './constants';
import { isOutboxMutationKey } from './outbox';

/** Persister do cache do React Query sobre AsyncStorage (nativo e web). */
export const queryCachePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: PERSIST_THROTTLE_TIME,
});

/**
 * Filtro de escrita no disco: só query bem-sucedida **e** com chave em
 * allowlist é desidratada (decisão LGPD do epic 167).
 */
export function shouldDehydrateQuery(query: Query): boolean {
  return query.state.status === 'success' && isPersistableQueryKey(query.queryKey);
}

/**
 * Filtro de escrita das mutations (story 169): só o que está **pausado**
 * esperando rede e pertence ao catálogo da outbox. É o que faz o lançamento
 * feito sem sinal sobreviver a fechar o app.
 *
 * Restringir ao catálogo é a mesma decisão LGPD da allowlist de queries: as
 * variáveis persistidas são dado pessoal (nome de filho, ocorrência) e saem no
 * logout junto do resto.
 */
export function shouldDehydrateMutation(mutation: Mutation): boolean {
  return mutation.state.isPaused && isOutboxMutationKey(mutation.options.mutationKey);
}

export const dehydrateOptions = { shouldDehydrateQuery, shouldDehydrateMutation };

/**
 * Apaga o cache persistido. Chamado no logout e na sessão expirada, junto das
 * chaves de auth: dado pessoal não pode sobreviver ao fim da sessão.
 *
 * Quem chama limpa antes o `queryClient` — assim, se uma gravação throttled
 * ainda estiver na fila, ela grava um cache vazio em vez de reescrever o antigo.
 */
export async function clearPersistedCache(): Promise<void> {
  await queryCachePersister.removeClient();
}
