import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { NextFunction, Request, Response } from 'express';
import { MetricsStore, RequestSample } from './metrics.store';
import {
  ObservabilityMiddleware,
  SENTRY_RATE_LIMIT_MAX_KEYS,
} from './observability.middleware';
import { QueryLogger } from './query-logger';

// Sentry fica INERTE nos testes: nunca dependemos de DSN nem de rede.
jest.mock('@sentry/nestjs', () => ({
  getActiveSpan: jest.fn(() => undefined),
  captureMessage: jest.fn(),
}));

const getActiveSpan = Sentry.getActiveSpan as jest.Mock;
const captureMessage = Sentry.captureMessage as jest.Mock;

interface FakeResponse extends EventEmitter {
  statusCode: number;
  setHeader: jest.Mock;
  headers: Record<string, unknown>;
  finish: () => void;
}

function makeRes(statusCode = 200): FakeResponse {
  const res = new EventEmitter() as FakeResponse;
  res.statusCode = statusCode;
  res.headers = {};
  res.setHeader = jest.fn((key: string, value: unknown) => {
    res.headers[key] = value;
  });
  res.finish = () => res.emit('finish');
  return res;
}

function makeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    method: 'GET',
    baseUrl: '/api/v1/residents',
    path: '/api/v1/residents',
    route: { path: '/' },
    ...overrides,
  } as unknown as Request;
}

function makeMetrics() {
  return { record: jest.fn() } as unknown as MetricsStore & { record: jest.Mock };
}

function recordedSample(metrics: { record: jest.Mock }, call = 0): RequestSample {
  return metrics.record.mock.calls[call][0] as RequestSample;
}

describe('ObservabilityMiddleware', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getActiveSpan.mockReturnValue(undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('registra a requisição feliz uma vez, com os contadores do próprio store', () => {
    const metrics = makeMetrics();
    const middleware = new ObservabilityMiddleware(metrics, { slowRequestMs: 1000 });
    const queryLogger = new QueryLogger({ logger: { warn: jest.fn(), error: jest.fn() } });
    const res = makeRes(200);

    middleware.use(makeReq(), res as unknown as Response, (() => {
      // Queries disparadas em profundidade arbitrária caem no store da requisição.
      queryLogger.logQuery();
      queryLogger.logQuery();
      queryLogger.logQuerySlow(12, 'SELECT 1');
    }) as NextFunction);
    res.finish();

    expect(metrics.record).toHaveBeenCalledTimes(1);
    const sample = recordedSample(metrics);
    expect(sample.status).toBe(200);
    expect(sample.method).toBe('GET');
    expect(sample.route).toBe('/api/v1/residents');
    expect(sample.durationMs).toBeGreaterThanOrEqual(0);
    expect(sample.cpuMs).toBeGreaterThanOrEqual(0);
    expect(sample.dbQueries).toBe(2);
    expect(sample.dbMs).toBe(12);
    expect(typeof sample.heapDeltaKb).toBe('number');
  });

  it('escreve X-Request-Id na resposta com o mesmo id registrado', () => {
    const metrics = makeMetrics();
    const middleware = new ObservabilityMiddleware(metrics, { slowRequestMs: 1000 });
    const res = makeRes(200);

    middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
    res.finish();

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    expect(res.headers['X-Request-Id']).toBe(recordedSample(metrics).requestId);
  });

  it('isola o store entre requisições concorrentes', () => {
    const metrics = makeMetrics();
    const middleware = new ObservabilityMiddleware(metrics, { slowRequestMs: 1000 });
    const queryLogger = new QueryLogger({ logger: { warn: jest.fn(), error: jest.fn() } });
    const resA = makeRes(200);
    const resB = makeRes(200);

    middleware.use(makeReq(), resA as unknown as Response, (() => {
      queryLogger.logQuery();
    }) as NextFunction);
    middleware.use(makeReq({ path: '/api/v1/houses', baseUrl: '/api/v1/houses' }), resB as unknown as Response, (() => {
      queryLogger.logQuery();
      queryLogger.logQuery();
      queryLogger.logQuery();
    }) as NextFunction);
    resA.finish();
    resB.finish();

    expect(recordedSample(metrics, 0).dbQueries).toBe(1);
    expect(recordedSample(metrics, 1).dbQueries).toBe(3);
  });

  it('registra requisição barrada por guard (403) — o handler nunca rodou', () => {
    const metrics = makeMetrics();
    const middleware = new ObservabilityMiddleware(metrics, { slowRequestMs: 1000 });
    // Sem `req.route`: o roteador nem chegou a casar a rota.
    const res = makeRes(403);

    middleware.use(
      makeReq({ route: undefined, path: '/api/v1/observability/stats' }),
      res as unknown as Response,
      (() => undefined) as NextFunction,
    );
    res.finish();

    const sample = recordedSample(metrics);
    expect(sample.status).toBe(403);
    expect(sample.route).toBe('/api/v1/observability/stats');
    // Status ≥ 400 sempre loga, mesmo rápido.
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('anexa o custo ao span ativo do Sentry', () => {
    const setAttributes = jest.fn();
    getActiveSpan.mockReturnValue({ setAttributes });
    const metrics = makeMetrics();
    const middleware = new ObservabilityMiddleware(metrics, { slowRequestMs: 1000 });
    const res = makeRes(200);

    middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
    res.finish();

    expect(setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'fonte.request_id': recordedSample(metrics).requestId,
        'fonte.cpu_ms': expect.any(Number),
        'fonte.db_queries': 0,
        'fonte.db_ms': 0,
        'fonte.heap_delta_kb': expect.any(Number),
      }),
    );
  });

  it('sem span ativo (Sentry inerte) não quebra', () => {
    getActiveSpan.mockReturnValue(undefined);
    const metrics = makeMetrics();
    const middleware = new ObservabilityMiddleware(metrics, { slowRequestMs: 1000 });
    const res = makeRes(200);

    expect(() => {
      middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
      res.finish();
    }).not.toThrow();
  });

  describe('requisição lenta', () => {
    // slowRequestMs: 0 → qualquer duração > 0 é lenta, sem precisar de timer falso.
    const slowOptions = { slowRequestMs: 0 };

    it('loga e manda um evento ao Sentry', () => {
      const metrics = makeMetrics();
      const middleware = new ObservabilityMiddleware(metrics, slowOptions);
      const res = makeRes(200);

      middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
      res.finish();

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(captureMessage).toHaveBeenCalledTimes(1);
      expect(captureMessage).toHaveBeenCalledWith(
        'slow request',
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({ route: 'GET /api/v1/residents' }),
        }),
      );
    });

    it('duas lentas na mesma rota dentro do minuto viram UM evento (rate limit)', () => {
      const metrics = makeMetrics();
      const middleware = new ObservabilityMiddleware(metrics, slowOptions);

      for (let i = 0; i < 2; i++) {
        const res = makeRes(200);
        middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
        res.finish();
      }

      expect(metrics.record).toHaveBeenCalledTimes(2);
      expect(captureMessage).toHaveBeenCalledTimes(1);
    });

    it('o mapa do rate limit não cresce sem limite', () => {
      const metrics = makeMetrics();
      const middleware = new ObservabilityMiddleware(metrics, slowOptions);

      // Mais rotas distintas do que o cap do rate limit: o mapa é esvaziado em
      // vez de virar vazamento de memória.
      for (let i = 0; i < SENTRY_RATE_LIMIT_MAX_KEYS + 5; i++) {
        const res = makeRes(200);
        middleware.use(
          makeReq({ baseUrl: `/api/v1/r${i}`, path: `/api/v1/r${i}` }),
          res as unknown as Response,
          (() => undefined) as NextFunction,
        );
        res.finish();
      }

      expect(captureMessage).toHaveBeenCalledTimes(SENTRY_RATE_LIMIT_MAX_KEYS + 5);
    });

    it('rotas diferentes têm rate limit independente', () => {
      const metrics = makeMetrics();
      const middleware = new ObservabilityMiddleware(metrics, slowOptions);

      const resA = makeRes(200);
      middleware.use(makeReq(), resA as unknown as Response, (() => undefined) as NextFunction);
      resA.finish();

      const resB = makeRes(200);
      middleware.use(
        makeReq({ baseUrl: '/api/v1/houses', path: '/api/v1/houses' }),
        resB as unknown as Response,
        (() => undefined) as NextFunction,
      );
      resB.finish();

      expect(captureMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('log de requisição', () => {
    it('rápida com status 200 e OBSERVABILITY_LOG_REQUESTS desligado não loga', () => {
      const metrics = makeMetrics();
      const middleware = new ObservabilityMiddleware(metrics, {
        slowRequestMs: 10_000,
        logRequests: false,
      });
      const res = makeRes(200);

      middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
      res.finish();

      expect(logSpy).not.toHaveBeenCalled();
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it('com logRequests ligado loga toda requisição', () => {
      const metrics = makeMetrics();
      const middleware = new ObservabilityMiddleware(metrics, {
        slowRequestMs: 10_000,
        logRequests: true,
      });
      const res = makeRes(200);

      middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
      res.finish();

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({ status: 200 });
    });
  });

  describe('configuração por ambiente', () => {
    const previousLog = process.env.OBSERVABILITY_LOG_REQUESTS;
    const previousSlow = process.env.OBSERVABILITY_SLOW_REQUEST_MS;

    afterEach(() => {
      if (previousLog === undefined) delete process.env.OBSERVABILITY_LOG_REQUESTS;
      else process.env.OBSERVABILITY_LOG_REQUESTS = previousLog;
      if (previousSlow === undefined) delete process.env.OBSERVABILITY_SLOW_REQUEST_MS;
      else process.env.OBSERVABILITY_SLOW_REQUEST_MS = previousSlow;
    });

    it('sem opções, lê OBSERVABILITY_LOG_REQUESTS e OBSERVABILITY_SLOW_REQUEST_MS', () => {
      process.env.OBSERVABILITY_LOG_REQUESTS = 'true';
      process.env.OBSERVABILITY_SLOW_REQUEST_MS = '10000';
      const metrics = makeMetrics();
      const middleware = new ObservabilityMiddleware(metrics);
      const res = makeRes(200);

      middleware.use(makeReq(), res as unknown as Response, (() => undefined) as NextFunction);
      res.finish();

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(captureMessage).not.toHaveBeenCalled();
    });
  });
});
