import { MutationCache, QueryClient } from '@tanstack/react-query';
import { QUERY_GC_TIME } from './offline/constants';
import { recordOutboxFailure } from './offline/outbox';

/**
 * Client único do app, criado fora da árvore React para que fluxos não-React
 * (logout, sessão expirada em `lib/auth`) consigam limpar o cache.
 *
 * - `gcTime` de 24h: sem isso a persistência é inútil (o default de 5 min
 *   coletaria a query antes de o cache reidratado ter serventia).
 * - `networkMode: 'offlineFirst'`: sem sinal a query **tenta uma vez** e depois
 *   pausa, mantendo o dado cacheado na tela em vez de cair em erro.
 */
/**
 * Ponte global fila → dead-letter (story 169): o React Query descarta a mutation
 * depois do erro definitivo, então é aqui — no único ponto por onde toda falha
 * final passa — que o lançamento é salvo para a tela de pendências. Nada é
 * descartado em silêncio.
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    void recordOutboxFailure(error, mutation);
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: QUERY_GC_TIME,
      networkMode: 'offlineFirst',
    },
  },
});
