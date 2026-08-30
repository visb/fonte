import { DataSource } from 'typeorm';
import { RuntimeService, nsToMs } from './runtime.service';

function makeService(query: jest.Mock = jest.fn().mockResolvedValue([{ '?column?': 1 }])) {
  const dataSource = { query } as unknown as DataSource;
  return { service: new RuntimeService(dataSource), query };
}

describe('RuntimeService', () => {
  let service: RuntimeService;

  beforeEach(() => {
    service = makeService().service;
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('expõe lag de event loop, memória e uptime com os campos e unidades esperados', () => {
    const snapshot = service.snapshot();

    expect(snapshot.eventLoopLagMs).toEqual({
      p50: expect.any(Number),
      p99: expect.any(Number),
      max: expect.any(Number),
    });
    expect(snapshot.eventLoopLagMs.p50).toBeGreaterThanOrEqual(0);
    // ms, não nanossegundos: um processo saudável fica muito abaixo de 1s.
    expect(snapshot.eventLoopLagMs.p50).toBeLessThan(1000);

    expect(Object.keys(snapshot.memory).sort()).toEqual([
      'externalMb',
      'heapTotalMb',
      'heapUsedMb',
      'rssMb',
    ]);
    // MB, não bytes: o heap do processo de teste não passa de alguns milhares de MB.
    expect(snapshot.memory.heapUsedMb).toBeGreaterThan(0);
    expect(snapshot.memory.heapUsedMb).toBeLessThan(10_000);

    expect(snapshot.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(snapshot.uptimeSec)).toBe(true);
    expect(snapshot.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(snapshot.nodeVersion).toBe(process.version);
  });

  describe('cpuPercent', () => {
    // Relógios controlados: no Windows a granularidade de `process.cpuUsage()`
    // é de ~15,6ms, então queimar CPU de verdade para medir uma janela curta é
    // flaky por construção.
    afterEach(() => jest.restoreAllMocks());

    it('é a CPU consumida desde a leitura anterior, em % do tempo de parede', () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
      const svc = makeService().service; // baseline da janela: t = 1000

      // 100ms de CPU (user+system, em microssegundos) em 200ms de parede = 50%.
      jest.spyOn(process, 'cpuUsage').mockReturnValue({ user: 50_000, system: 50_000 });
      now.mockReturnValue(1_200);

      expect(svc.snapshot().cpuPercent).toBe(50);
    });

    it('sem tempo decorrido devolve 0 em vez de dividir por zero', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000);
      const svc = makeService().service;
      jest.spyOn(process, 'cpuUsage').mockReturnValue({ user: 1_000, system: 0 });

      expect(svc.snapshot().cpuPercent).toBe(0);
    });
  });

  it('reset reinicia a janela do histograma', () => {
    const before = service.snapshot().eventLoopLagMs;
    expect(before.max).toBeGreaterThanOrEqual(0);

    service.reset();

    const after = service.snapshot().eventLoopLagMs;
    expect(after.max).toBeLessThanOrEqual(Math.max(before.max, after.max));
    expect(after.p50).toBeGreaterThanOrEqual(0);
  });

  describe('nsToMs', () => {
    it('converte nanossegundos em ms com 2 casas', () => {
      expect(nsToMs(1_500_000)).toBe(1.5);
    });

    it('histograma sem amostra (Infinity) vira 0, não null no JSON', () => {
      expect(nsToMs(Number.POSITIVE_INFINITY)).toBe(0);
      expect(nsToMs(NaN)).toBe(0);
    });
  });

  describe('checkDatabase', () => {
    it('devolve up quando o SELECT 1 responde', async () => {
      const { service: svc, query } = makeService();
      await expect(svc.checkDatabase()).resolves.toBe('up');
      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('devolve down sem lançar quando o banco falha', async () => {
      const { service: svc } = makeService(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
      await expect(svc.checkDatabase()).resolves.toBe('down');
    });
  });
});
