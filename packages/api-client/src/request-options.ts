import type { AxiosRequestConfig } from 'axios';

/**
 * Opções por chamada dos métodos de escrita cobertos por idempotência no backend
 * (story 172). Não é header global do axios de propósito: cada requisição
 * enfileirada pela outbox do ops tem a **sua** chave — uma chave global
 * deduplicaria tudo.
 */
export interface RequestOptions {
  /**
   * Valor do header `Idempotency-Key` (UUID). Gerado uma vez para o item da fila
   * e **reusado em todo reenvio** — chave nova a cada retry anula a idempotência.
   * Omitido, a requisição segue o comportamento de sempre.
   */
  idempotencyKey?: string;
}

/**
 * Config extra do axios como tupla para spread (`http.post(url, data, ...x)`):
 * sem opções não passa terceiro argumento nenhum, mantendo a chamada idêntica à
 * de antes desta story.
 */
export function requestConfig(options?: RequestOptions): [AxiosRequestConfig] | [] {
  if (!options?.idempotencyKey) return [];
  return [{ headers: { 'Idempotency-Key': options.idempotencyKey } }];
}
