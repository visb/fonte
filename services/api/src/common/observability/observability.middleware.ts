import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, NestMiddleware, Optional } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { NextFunction, Request, Response } from 'express';
import { MetricsStore } from './metrics.store';
import { createRequestStore, runWithRequestStore } from './request-context';
import { routePathOf } from './route-name';

/**
 * Middleware Express que mede o custo de CADA requisição (story 191).
 *
 * Por que middleware e não `NestInterceptor`: um interceptor roda DEPOIS dos
 * guards e não roda quando um guard rejeita — requisição barrada por
 * `JwtAuthGuard`/`RolesGuard`/`ThrottlerGuard`, justamente o tráfego que
 * interessa medir sob suspeita de abuso, ficaria invisível. O middleware
 * envolve a cadeia inteira (guards, pipes, handler, serialização, exception
 * filter) e fecha em `res.on('finish')`.
 *
 * É também aqui que o `AsyncLocalStorage` abre: o `JwtAuthGuard` consulta o
 * banco, e essa query é custo da requisição.
 */

export const OBSERVABILITY_OPTIONS = 'OBSERVABILITY_OPTIONS';

/** Default de `OBSERVABILITY_SLOW_REQUEST_MS`. */
export const DEFAULT_SLOW_REQUEST_MS = 1000;
/** Máximo de 1 evento de request lenta por rota por minuto. */
export const SENTRY_SLOW_REQUEST_WINDOW_MS = 60_000;
/** Trava de memória do rate limit (a chave é rota normalizada, mas ainda assim). */
export const SENTRY_RATE_LIMIT_MAX_KEYS = 500;

export interface ObservabilityOptions {
  /** Acima disso a requisição é lenta: loga e (com rate limit) vai ao Sentry. */
  slowRequestMs?: number;
  /** `OBSERVABILITY_LOG_REQUESTS=true` loga TODAS. Em 1 vCPU, default é false. */
  logRequests?: boolean;
}

@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Observability');
  private readonly slowRequestMs: number;
  private readonly logRequests: boolean;
  /** rota → epoch ms do último evento enviado ao Sentry. */
  private readonly lastSentryEventAt = new Map<string, number>();

  constructor(
    private readonly metrics: MetricsStore,
    @Optional() @Inject(OBSERVABILITY_OPTIONS) options?: ObservabilityOptions,
  ) {
    this.slowRequestMs =
      options?.slowRequestMs ??
      Number(process.env.OBSERVABILITY_SLOW_REQUEST_MS ?? DEFAULT_SLOW_REQUEST_MS);
    this.logRequests =
      options?.logRequests ?? process.env.OBSERVABILITY_LOG_REQUESTS === 'true';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const store = createRequestStore(requestId);
    const startedAt = process.hrtime.bigint();
    const cpuStart = process.cpuUsage();
    const heapStart = process.memoryUsage().heapUsed;

    // Cola o log da API ao evento no Sentry e à linha do ring buffer.
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const cpuDelta = process.cpuUsage(cpuStart);
      const cpuMs = (cpuDelta.user + cpuDelta.system) / 1000;
      const heapDeltaKb = (process.memoryUsage().heapUsed - heapStart) / 1024;
      const route = routePathOf(req);
      const method = (req.method ?? 'GET').toUpperCase();
      const status = res.statusCode;

      const sample = {
        requestId,
        method,
        route,
        status,
        durationMs: round(durationMs),
        cpuMs: round(cpuMs),
        dbQueries: store.dbQueries,
        dbMs: round(store.dbMs),
        heapDeltaKb: round(heapDeltaKb),
      };

      this.metrics.record(sample);
      this.annotateSentrySpan(sample);

      const slow = durationMs > this.slowRequestMs;
      // Em 1 vCPU, logar toda requisição por padrão é I/O sem retorno.
      if (this.logRequests || slow || status >= 400) {
        this.logger.log(JSON.stringify(sample));
      }
      if (slow) this.reportSlowRequest(sample);
    });

    runWithRequestStore(store, next);
  }

  /**
   * Custo por requisição vira ATRIBUTO do span — é assim que a visão histórica
   * e o p95 por transação saem do Sentry, que já está pago e configurado.
   * (`setMeasurement` foi removido do SDK v10; atributo de span é o caminho.)
   */
  private annotateSentrySpan(sample: {
    requestId: string;
    cpuMs: number;
    dbQueries: number;
    dbMs: number;
    heapDeltaKb: number;
  }): void {
    Sentry.getActiveSpan()?.setAttributes({
      'fonte.request_id': sample.requestId,
      'fonte.cpu_ms': sample.cpuMs,
      'fonte.db_queries': sample.dbQueries,
      'fonte.db_ms': sample.dbMs,
      'fonte.heap_delta_kb': sample.heapDeltaKb,
    });
  }

  /**
   * `tracesSampleRate` é 0.1: a requisição lenta pode simplesmente não estar na
   * amostra. Por isso mandamos um evento próprio — mas com rate limit de 1 por
   * rota por minuto, senão um endpoint degradado queima a quota em minutos.
   */
  private reportSlowRequest(sample: {
    requestId: string;
    method: string;
    route: string;
    status: number;
    durationMs: number;
    cpuMs: number;
    dbQueries: number;
    dbMs: number;
  }): void {
    const key = `${sample.method} ${sample.route}`;
    const now = Date.now();
    const last = this.lastSentryEventAt.get(key);
    if (last !== undefined && now - last < SENTRY_SLOW_REQUEST_WINDOW_MS) return;

    if (this.lastSentryEventAt.size >= SENTRY_RATE_LIMIT_MAX_KEYS) {
      this.lastSentryEventAt.clear();
    }
    this.lastSentryEventAt.set(key, now);

    Sentry.captureMessage('slow request', {
      level: 'warning',
      tags: { route: key, status: String(sample.status) },
      extra: {
        requestId: sample.requestId,
        durationMs: sample.durationMs,
        cpuMs: sample.cpuMs,
        dbQueries: sample.dbQueries,
        dbMs: sample.dbMs,
      },
    });
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
