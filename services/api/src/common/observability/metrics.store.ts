import { Inject, Injectable, Optional } from '@nestjs/common';

/**
 * Agregado de custo por rota + ring buffer das últimas requisições (story 191).
 *
 * Tudo em memória, sem I/O, sem persistência: morre no restart — histórico é o
 * Sentry. Memória é CONSTANTE por desenho:
 *  - por rota guardamos SOMAS e um histograma de buckets fixos (nunca a lista
 *    de amostras), o que dá p50/p95 aproximados a custo O(1);
 *  - o número de rotas distintas tem cap (`maxRoutes`), com excedente caindo no
 *    bucket `OTHER`;
 *  - as últimas requisições vivem num array de tamanho fixo com índice
 *    circular (sem `shift()`).
 *
 * LGPD: NADA de dado pessoal aqui. Sem body, sem query string, sem IP, sem
 * user_id. Só rota normalizada, status e números.
 */

/** Limites superiores dos buckets, em ms. O último (`Infinity`) é o `+Inf`. */
export const DURATION_BUCKETS_MS = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, Number.POSITIVE_INFINITY,
];

/** Chave do balde onde caem as rotas que estouraram o cap de cardinalidade. */
export const OTHER_ROUTE = 'OTHER';

export const METRICS_STORE_OPTIONS = 'METRICS_STORE_OPTIONS';

export interface MetricsStoreOptions {
  /** Quantas requisições o ring buffer guarda (default 200). */
  recentSize?: number;
  /** Máximo de rotas distintas antes do bucket `OTHER` (default 300). */
  maxRoutes?: number;
}

/** Uma requisição já medida, pronta para entrar no agregado. */
export interface RequestSample {
  requestId: string;
  method: string;
  /** Path JÁ normalizado (ver `route-name.ts`). */
  route: string;
  status: number;
  durationMs: number;
  cpuMs: number;
  dbQueries: number;
  dbMs: number;
  heapDeltaKb: number;
}

/** Item do ring buffer, como sai no `GET /observability/stats`. */
export interface RecentRequest extends RequestSample {
  /** ISO 8601 do fim da requisição. */
  at: string;
}

/** Agregado por rota, já com as médias/percentis derivados das somas. */
export interface RouteStats {
  /** Chave `${method} ${path}` (ou `OTHER`). */
  route: string;
  count: number;
  errors: number;
  avgDurationMs: number;
  maxDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  avgCpuMs: number;
  avgDbQueries: number;
  avgDbMs: number;
  avgHeapDeltaKb: number;
  lastAt: string;
}

interface RouteAccumulator {
  count: number;
  errors: number;
  sumDurationMs: number;
  maxDurationMs: number;
  sumCpuMs: number;
  sumDbQueries: number;
  sumDbMs: number;
  sumHeapDeltaKb: number;
  lastAt: number;
  buckets: number[];
}

function emptyAccumulator(): RouteAccumulator {
  return {
    count: 0,
    errors: 0,
    sumDurationMs: 0,
    maxDurationMs: 0,
    sumCpuMs: 0,
    sumDbQueries: 0,
    sumDbMs: 0,
    sumHeapDeltaKb: 0,
    lastAt: 0,
    buckets: new Array(DURATION_BUCKETS_MS.length).fill(0),
  };
}

/** Arredonda para 3 casas — evita ruído de float no JSON da tela. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

@Injectable()
export class MetricsStore {
  private readonly routes = new Map<string, RouteAccumulator>();
  private readonly recentSize: number;
  private readonly maxRoutes: number;
  private recentBuffer: (RecentRequest | undefined)[];
  private recentWriteIndex = 0;
  private startedAt = new Date();

  constructor(
    @Optional() @Inject(METRICS_STORE_OPTIONS) options?: MetricsStoreOptions,
  ) {
    this.recentSize = Math.max(1, options?.recentSize ?? 200);
    this.maxRoutes = Math.max(1, options?.maxRoutes ?? 300);
    this.recentBuffer = new Array(this.recentSize).fill(undefined);
  }

  /** Registra uma requisição concluída. Chamado uma vez por `res.on('finish')`. */
  record(sample: RequestSample): void {
    const key = this.keyFor(sample);
    const entry = this.routes.get(key) ?? emptyAccumulator();
    const at = Date.now();

    entry.count += 1;
    if (sample.status >= 400) entry.errors += 1;
    entry.sumDurationMs += sample.durationMs;
    entry.maxDurationMs = Math.max(entry.maxDurationMs, sample.durationMs);
    entry.sumCpuMs += sample.cpuMs;
    entry.sumDbQueries += sample.dbQueries;
    entry.sumDbMs += sample.dbMs;
    entry.sumHeapDeltaKb += sample.heapDeltaKb;
    entry.lastAt = at;
    entry.buckets[bucketIndexOf(sample.durationMs)] += 1;
    this.routes.set(key, entry);

    this.recentBuffer[this.recentWriteIndex] = { ...sample, at: new Date(at).toISOString() };
    this.recentWriteIndex = (this.recentWriteIndex + 1) % this.recentSize;
  }

  /**
   * Chave do agregado. Rota nova depois do cap cai em `OTHER` — trava de
   * segurança sobre a normalização de `route-name.ts`.
   */
  private keyFor(sample: RequestSample): string {
    const key = `${sample.method} ${sample.route}`;
    if (this.routes.has(key)) return key;
    if (this.routes.size >= this.maxRoutes) return OTHER_ROUTE;
    return key;
  }

  /** Agregado por rota, ordenado por `count` decrescente. */
  getRoutes(): RouteStats[] {
    return [...this.routes.entries()]
      .map(([route, entry]) => ({
        route,
        count: entry.count,
        errors: entry.errors,
        avgDurationMs: round(entry.sumDurationMs / entry.count),
        maxDurationMs: round(entry.maxDurationMs),
        p50DurationMs: percentileOf(entry, 0.5),
        p95DurationMs: percentileOf(entry, 0.95),
        avgCpuMs: round(entry.sumCpuMs / entry.count),
        avgDbQueries: round(entry.sumDbQueries / entry.count),
        avgDbMs: round(entry.sumDbMs / entry.count),
        avgHeapDeltaKb: round(entry.sumHeapDeltaKb / entry.count),
        lastAt: new Date(entry.lastAt).toISOString(),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Últimas requisições, MAIS RECENTE PRIMEIRO. */
  getRecent(limit?: number): RecentRequest[] {
    const out: RecentRequest[] = [];
    const max = Math.min(limit ?? this.recentSize, this.recentSize);
    for (let step = 1; step <= this.recentSize && out.length < max; step++) {
      const index = (this.recentWriteIndex - step + this.recentSize) % this.recentSize;
      const item = this.recentBuffer[index];
      if (item) out.push(item);
    }
    return out;
  }

  /** Início da janela atual (boot ou último `reset()`). */
  getStartedAt(): string {
    return this.startedAt.toISOString();
  }

  /** Quantas rotas distintas estão no Map (inclui `OTHER`). */
  get routeCount(): number {
    return this.routes.size;
  }

  /** Zera a janela: agregado, ring buffer e marco temporal. */
  reset(): void {
    this.routes.clear();
    this.recentBuffer = new Array(this.recentSize).fill(undefined);
    this.recentWriteIndex = 0;
    this.startedAt = new Date();
  }
}

/** Índice do bucket que recebe uma duração. */
export function bucketIndexOf(durationMs: number): number {
  for (let i = 0; i < DURATION_BUCKETS_MS.length; i++) {
    if (durationMs <= DURATION_BUCKETS_MS[i]) return i;
  }
  return DURATION_BUCKETS_MS.length - 1;
}

/**
 * Percentil aproximado a partir do histograma: devolve o limite SUPERIOR do
 * primeiro bucket cuja soma acumulada alcança o percentil. O bucket `+Inf` não
 * tem limite útil, então cai no `maxDurationMs` observado.
 */
function percentileOf(entry: RouteAccumulator, percentile: number): number {
  const target = entry.count * percentile;
  let cumulative = 0;
  for (let i = 0; i < entry.buckets.length; i++) {
    cumulative += entry.buckets[i];
    if (cumulative >= target) {
      const upper = DURATION_BUCKETS_MS[i];
      return Number.isFinite(upper) ? upper : round(entry.maxDurationMs);
    }
  }
  return round(entry.maxDurationMs);
}
