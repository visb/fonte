import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Custo de banco acumulado DURANTE uma requisição (story 191).
 *
 * O objeto é MUTÁVEL de propósito: o `QueryLogger` do TypeORM incrementa os
 * campos direto, sem re-`run` do AsyncLocalStorage. É o único jeito de somar
 * queries disparadas em profundidade arbitrária (guard → service → repository)
 * sem passar contexto por parâmetro em todo o backend.
 *
 * SEM DADO PESSOAL: só contadores. Nada de body, query string, IP ou user_id.
 */
export interface RequestStore {
  /** UUID da requisição; também sai no header `X-Request-Id`. */
  requestId: string;
  /** Quantas queries o TypeORM executou (via `logQuery`). */
  dbQueries: number;
  /**
   * Soma do tempo das queries em ms. PARCIAL por limitação do TypeORM: só
   * queries que estouram `maxQueryExecutionTime` (=1ms) reportam duração, então
   * queries sub-milissegundo entram em `dbQueries` mas não aqui. O sintoma que
   * importa (N+1) aparece na CONTAGEM; o tempo das sub-ms é ruído.
   */
  dbMs: number;
  /** Queries acima de `DB_SLOW_QUERY_MS`. */
  slowQueries: number;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

/** Store novo e zerado para uma requisição. */
export function createRequestStore(requestId: string): RequestStore {
  return { requestId, dbQueries: 0, dbMs: 0, slowQueries: 0 };
}

/**
 * Executa `fn` com o store ativo. Fora de uma requisição (scheduler, seed,
 * boot) `requestContext.getStore()` devolve `undefined` — todo consumidor
 * trata a ausência como no-op, nunca lança.
 */
export function runWithRequestStore<T>(store: RequestStore, fn: () => T): T {
  return requestContext.run(store, fn);
}
