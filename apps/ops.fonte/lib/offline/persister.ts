import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import {
  isPersistableQueryKey,
  PERSIST_KEY,
  PERSIST_THROTTLE_TIME,
} from './constants';

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

export const dehydrateOptions = { shouldDehydrateQuery };

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
