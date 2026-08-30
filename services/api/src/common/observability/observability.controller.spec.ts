import { MetricsStore, RequestSample } from './metrics.store';
import { ObservabilityController } from './observability.controller';
import { RuntimeService, RuntimeSnapshot } from './runtime.service';

const RUNTIME: RuntimeSnapshot = {
  uptimeSec: 42,
  eventLoopLagMs: { p50: 1, p99: 9, max: 30 },
  memory: { rssMb: 120, heapUsedMb: 60, heapTotalMb: 90, externalMb: 5 },
  cpuPercent: 12.5,
  nodeVersion: 'v22.0.0',
};

function sample(overrides: Partial<RequestSample> = {}): RequestSample {
  return {
    requestId: 'req-1',
    method: 'GET',
    route: '/api/v1/residents',
    status: 200,
    durationMs: 10,
    cpuMs: 5,
    dbQueries: 2,
    dbMs: 3,
    heapDeltaKb: 4,
    ...overrides,
  };
}

function makeRuntime(overrides: Partial<RuntimeService> = {}) {
  return {
    snapshot: jest.fn(() => RUNTIME),
    checkDatabase: jest.fn().mockResolvedValue('up'),
    reset: jest.fn(),
    ...overrides,
  } as unknown as RuntimeService & { snapshot: jest.Mock; checkDatabase: jest.Mock; reset: jest.Mock };
}

describe('ObservabilityController', () => {
  describe('stats', () => {
    it('compõe runtime + rotas + recentes, com as médias derivadas das somas', () => {
      const metrics = new MetricsStore();
      // count: 4, sumCpuMs: 20 → avgCpuMs: 5
      for (const cpuMs of [2, 4, 6, 8]) metrics.record(sample({ cpuMs }));
      const runtime = makeRuntime();
      const controller = new ObservabilityController(metrics, runtime);

      const result = controller.stats();

      expect(result.runtime).toEqual(RUNTIME);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0]).toMatchObject({
        route: 'GET /api/v1/residents',
        count: 4,
        avgCpuMs: 5,
      });
      expect(result.recent).toHaveLength(4);
      expect(result.startedAt).toBe(metrics.getStartedAt());
      expect(runtime.snapshot).toHaveBeenCalledTimes(1);
    });

    it('sem tráfego devolve listas vazias', () => {
      const controller = new ObservabilityController(new MetricsStore(), makeRuntime());
      const result = controller.stats();
      expect(result.routes).toEqual([]);
      expect(result.recent).toEqual([]);
    });
  });

  describe('health', () => {
    it('devolve ok com o banco no ar e SEM expor memória ou rotas', async () => {
      const controller = new ObservabilityController(new MetricsStore(), makeRuntime());

      const result = await controller.health();

      expect(result.status).toBe('ok');
      expect(result.db).toBe('up');
      expect(result.uptimeSec).toBeGreaterThanOrEqual(0);
      // Rota pública: nada além disso — não ajuda quem está sondando o host.
      expect(Object.keys(result).sort()).toEqual(['db', 'status', 'uptimeSec']);
    });

    it('com o SELECT 1 falhando devolve degraded/down sem lançar', async () => {
      const runtime = makeRuntime({
        checkDatabase: jest.fn().mockResolvedValue('down'),
      } as unknown as Partial<RuntimeService>);
      const controller = new ObservabilityController(new MetricsStore(), runtime);

      await expect(controller.health()).resolves.toMatchObject({
        status: 'degraded',
        db: 'down',
      });
    });
  });

  describe('reset', () => {
    it('zera o store e a janela do event loop', () => {
      const metrics = new MetricsStore();
      metrics.record(sample());
      const runtime = makeRuntime();
      const controller = new ObservabilityController(metrics, runtime);

      const result = controller.reset();

      expect(metrics.getRoutes()).toEqual([]);
      expect(metrics.getRecent()).toEqual([]);
      expect(runtime.reset).toHaveBeenCalledTimes(1);
      expect(result.startedAt).toBe(metrics.getStartedAt());
    });
  });
});
