import type { ObservabilityRouteStats } from '@fonte/api-client';

/**
 * Thresholds e labels da tela de observabilidade (story 192).
 *
 * Tudo que é "a partir de quanto isso é suspeito" mora aqui, nunca solto no
 * JSX: os números vieram da leitura de 1 vCPU (story 191) e vão ser ajustados
 * com a operação real.
 */

/** Poll da tela viva. 10s é o piso: cada poll é ele próprio uma requisição medida. */
export const STATS_REFETCH_INTERVAL_MS = 10_000;

/** Acima disso, a média de queries por requisição cheira a N+1. */
export const N_PLUS_ONE_QUERIES_THRESHOLD = 20;

/** Acima disso, o p95 da rota é lentidão perceptível pelo usuário. */
export const SLOW_P95_MS_THRESHOLD = 1000;

/**
 * Lag de event loop (p99) acima disso significa que alguma coisa está
 * travando o processo — Puppeteer (PDF), sharp (thumbnail) ou pg_dump (backup).
 */
export const EVENT_LOOP_LAG_ALERT_MS = 100;

/** CPU do processo (desde a leitura anterior) acima disso é saturação em 1 vCPU. */
export const CPU_PERCENT_ALERT = 80;

/**
 * RSS acima disso é sinal de aperto de memória no VPS. O contrato da story 191
 * não expõe o limite do container, então o teto vive aqui como threshold de UI.
 */
export const RSS_ALERT_MB = 512;

/** Status HTTP a partir do qual a requisição conta como erro (mesmo corte do backend). */
export const ERROR_STATUS_THRESHOLD = 400;

/** Bucket de estouro de cardinalidade do store (story 191). */
export const OTHER_ROUTE = 'OTHER';

export const OTHER_ROUTE_LABEL =
  'Demais rotas (bucket de estouro do limite de rotas distintas)';

/** Aviso permanente: o agregado é volátil por desenho. */
export const VOLATILE_DATA_NOTICE =
  'Os números são desde o último restart da API (ou do último "Zerar contadores") e vivem só em memória. Histórico e alertas ficam no Sentry.';

export const EVENT_LOOP_LAG_HINT =
  'Tempo que o event loop ficou bloqueado. É o número que denuncia Puppeteer (PDF), sharp (thumbnail) e pg_dump (backup) travando o processo.';

export const AVG_DB_MS_HINT =
  'Parcial: o TypeORM só reporta duração de query acima de 1ms. Para caçar N+1, olhe a contagem de queries.';

/** Chaves ordenáveis da tabela por rota. */
export type RouteSortKey = 'p95DurationMs' | 'avgCpuMs' | 'avgDbQueries';

export interface RouteColumn {
  key: keyof ObservabilityRouteStats;
  label: string;
  /** Só as três lentes de custo são ordenáveis. */
  sortKey?: RouteSortKey;
  hint?: string;
}

export const ROUTE_COST_COLUMNS: RouteColumn[] = [
  { key: 'route', label: 'Rota' },
  { key: 'count', label: 'Chamadas' },
  { key: 'errors', label: 'Erros' },
  { key: 'p50DurationMs', label: 'p50' },
  { key: 'p95DurationMs', label: 'p95', sortKey: 'p95DurationMs' },
  { key: 'maxDurationMs', label: 'Máx' },
  { key: 'avgCpuMs', label: 'CPU médio', sortKey: 'avgCpuMs' },
  { key: 'avgDbQueries', label: 'Queries médias', sortKey: 'avgDbQueries' },
  { key: 'avgDbMs', label: 'DB ms médio', hint: AVG_DB_MS_HINT },
];

export const RECENT_REQUEST_COLUMNS = [
  'Horário',
  'Método',
  'Rota',
  'Status',
  'Duração',
  'CPU',
  'Queries',
] as const;
