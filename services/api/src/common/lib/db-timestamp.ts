/**
 * Converte um `Date` para o literal que as colunas `timestamp without time zone`
 * deste schema realmente guardam: hora **UTC**, sem fuso.
 *
 * Por que isto existe: as colunas de auditoria (`created_at`, `updated_at`,
 * `deleted_at`) são `timestamp` sem fuso e são escritas pelo relógio do banco
 * (`now()`), que roda em UTC. Já o driver `pg`, ao serializar um `Date` como
 * parâmetro, escreve a hora **local do processo** com o offset anexado — e o
 * Postgres, para uma coluna sem fuso, descarta o offset e guarda o número. Numa
 * API rodando em UTC-3, `updated_at > :since` com `since` sendo um `Date` vira
 * uma janela três horas mais larga do que o pedido: o delta devolveria "tudo que
 * mudou nas últimas 3 horas" como se tivesse mudado desde o último sync.
 *
 * Passando a string já normalizada em UTC, a comparação acontece no mesmo
 * referencial da escrita, em qualquer fuso do servidor.
 */
export function toDbTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}
