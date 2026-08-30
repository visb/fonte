import { MetricsStore, OTHER_ROUTE, RequestSample, bucketIndexOf } from './metrics.store';

function sample(overrides: Partial<RequestSample> = {}): RequestSample {
  return {
    requestId: 'req-1',
    method: 'GET',
    route: '/api/v1/residents',
    status: 200,
    durationMs: 7,
    cpuMs: 2,
    dbQueries: 3,
    dbMs: 4,
    heapDeltaKb: 5,
    ...overrides,
  };
}

describe('MetricsStore', () => {
  describe('record', () => {
    it('soma count, erros e as somas de cpu/db/heap por rota', () => {
      const store = new MetricsStore();

      store.record(sample({ status: 200, cpuMs: 2, dbQueries: 1, dbMs: 10, heapDeltaKb: 100 }));
      store.record(sample({ status: 302, cpuMs: 4, dbQueries: 3, dbMs: 20, heapDeltaKb: 200 }));
      store.record(sample({ status: 400, cpuMs: 6, dbQueries: 5, dbMs: 30, heapDeltaKb: 300 }));
      store.record(sample({ status: 500, cpuMs: 8, dbQueries: 7, dbMs: 40, heapDeltaKb: 400 }));

      const [route] = store.getRoutes();
      expect(route.route).toBe('GET /api/v1/residents');
      expect(route.count).toBe(4);
      // 400 e 500 contam como erro; 200 e 302 não.
      expect(route.errors).toBe(2);
      expect(route.avgCpuMs).toBe(5);
      expect(route.avgDbQueries).toBe(4);
      expect(route.avgDbMs).toBe(25);
      expect(route.avgHeapDeltaKb).toBe(250);
    });

    it('guarda duração média e máxima', () => {
      const store = new MetricsStore();
      store.record(sample({ durationMs: 10 }));
      store.record(sample({ durationMs: 30 }));

      const [route] = store.getRoutes();
      expect(route.avgDurationMs).toBe(20);
      expect(route.maxDurationMs).toBe(30);
    });

    it('separa rotas por método e path', () => {
      const store = new MetricsStore();
      store.record(sample({ method: 'GET' }));
      store.record(sample({ method: 'POST' }));

      expect(store.getRoutes().map((r) => r.route).sort()).toEqual([
        'GET /api/v1/residents',
        'POST /api/v1/residents',
      ]);
    });

    it('ordena as rotas por count decrescente', () => {
      const store = new MetricsStore();
      store.record(sample({ route: '/a' }));
      store.record(sample({ route: '/b' }));
      store.record(sample({ route: '/b' }));

      expect(store.getRoutes().map((r) => r.route)).toEqual(['GET /b', 'GET /a']);
    });
  });

  describe('percentis por bucket', () => {
    it('devolve o bucket certo para uma distribuição conhecida', () => {
      const store = new MetricsStore();
      // 8 requisições rápidas (bucket 5ms) + 2 lentas (bucket 1000ms).
      for (let i = 0; i < 8; i++) store.record(sample({ durationMs: 3 }));
      for (let i = 0; i < 2; i++) store.record(sample({ durationMs: 900 }));

      const [route] = store.getRoutes();
      expect(route.p50DurationMs).toBe(5);
      expect(route.p95DurationMs).toBe(1000);
    });

    it('com uma única amostra, p50 = p95', () => {
      const store = new MetricsStore();
      store.record(sample({ durationMs: 7 }));

      const [route] = store.getRoutes();
      expect(route.p50DurationMs).toBe(10);
      expect(route.p95DurationMs).toBe(10);
    });

    it('amostra acima do último bucket cai no máximo observado (+Inf)', () => {
      const store = new MetricsStore();
      store.record(sample({ durationMs: 9000 }));

      const [route] = store.getRoutes();
      expect(route.p95DurationMs).toBe(9000);
    });

    it('rota sem amostra não aparece', () => {
      const store = new MetricsStore();
      expect(store.getRoutes()).toEqual([]);
      expect(store.getRecent()).toEqual([]);
    });

    it('bucketIndexOf mapeia a duração para o balde correto', () => {
      expect(bucketIndexOf(1)).toBe(0);
      expect(bucketIndexOf(5)).toBe(0);
      expect(bucketIndexOf(6)).toBe(1);
      expect(bucketIndexOf(999999)).toBe(10);
    });
  });

  describe('ring buffer', () => {
    it('sobrescreve o mais antigo e devolve em ordem cronológica decrescente', () => {
      const store = new MetricsStore({ recentSize: 3 });
      store.record(sample({ requestId: 'r1' }));
      store.record(sample({ requestId: 'r2' }));
      store.record(sample({ requestId: 'r3' }));
      store.record(sample({ requestId: 'r4' }));

      // Sem shift(): a 4ª sobrescreveu o slot da 1ª.
      expect(store.getRecent().map((r) => r.requestId)).toEqual(['r4', 'r3', 'r2']);
    });

    it('respeita o limite pedido na leitura', () => {
      const store = new MetricsStore({ recentSize: 5 });
      store.record(sample({ requestId: 'r1' }));
      store.record(sample({ requestId: 'r2' }));

      expect(store.getRecent(1).map((r) => r.requestId)).toEqual(['r2']);
    });

    it('carimba o horário de cada requisição', () => {
      const store = new MetricsStore();
      store.record(sample());
      expect(store.getRecent()[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('não guarda dado pessoal — só rota normalizada, status e números (LGPD)', () => {
      const store = new MetricsStore();
      store.record(sample());

      expect(Object.keys(store.getRecent()[0]).sort()).toEqual([
        'at',
        'cpuMs',
        'dbMs',
        'dbQueries',
        'durationMs',
        'heapDeltaKb',
        'method',
        'requestId',
        'route',
        'status',
      ]);
    });
  });

  describe('cap de cardinalidade', () => {
    it('joga a 3ª rota distinta no bucket OTHER e não deixa o Map crescer', () => {
      const store = new MetricsStore({ maxRoutes: 2 });
      store.record(sample({ route: '/a' }));
      store.record(sample({ route: '/b' }));
      store.record(sample({ route: '/c' }));
      store.record(sample({ route: '/d' }));

      expect(store.routeCount).toBe(3);
      const routes = store.getRoutes().map((r) => r.route);
      expect(routes).toContain(OTHER_ROUTE);
      expect(routes).not.toContain('GET /c');
      expect(store.getRoutes().find((r) => r.route === OTHER_ROUTE)?.count).toBe(2);
    });

    it('rota já conhecida continua contando depois do cap', () => {
      const store = new MetricsStore({ maxRoutes: 2 });
      store.record(sample({ route: '/a' }));
      store.record(sample({ route: '/b' }));
      store.record(sample({ route: '/c' }));
      store.record(sample({ route: '/a' }));

      expect(store.getRoutes().find((r) => r.route === 'GET /a')?.count).toBe(2);
      expect(store.routeCount).toBe(3);
    });
  });

  describe('reset', () => {
    it('zera rotas, ring buffer e reabre a janela', () => {
      const store = new MetricsStore();
      const before = store.getStartedAt();
      store.record(sample());

      store.reset();

      expect(store.getRoutes()).toEqual([]);
      expect(store.getRecent()).toEqual([]);
      expect(store.routeCount).toBe(0);
      expect(Date.parse(store.getStartedAt())).toBeGreaterThanOrEqual(Date.parse(before));
    });
  });
});
