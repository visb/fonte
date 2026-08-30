import { QueryLogger } from './query-logger';
import { createRequestStore, requestContext, runWithRequestStore } from './request-context';

function makeLogger(slowQueryMs = 200) {
  const logger = { warn: jest.fn(), error: jest.fn() };
  return { queryLogger: new QueryLogger({ slowQueryMs, logger }), logger };
}

const SELECT_WITH_PARAMS = 'SELECT * FROM residents WHERE cpf = $1 AND name = $2';
const PARAMS = ['12345678900', 'Fulano de Tal'];

describe('QueryLogger', () => {
  describe('fora de uma requisição', () => {
    it('logQuery não lança (scheduler, seed, migration, boot)', () => {
      const { queryLogger } = makeLogger();
      expect(requestContext.getStore()).toBeUndefined();
      expect(() => queryLogger.logQuery()).not.toThrow();
    });

    it('logQuerySlow não lança e ainda assim loga a query lenta', () => {
      const { queryLogger, logger } = makeLogger();
      expect(() => queryLogger.logQuerySlow(500, 'SELECT 1')).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('requestId=-'));
    });
  });

  describe('dentro de uma requisição', () => {
    it('conta cada query no store da requisição', () => {
      const { queryLogger } = makeLogger();
      const store = createRequestStore('req-1');

      runWithRequestStore(store, () => {
        queryLogger.logQuery();
        queryLogger.logQuery();
        queryLogger.logQuery();
      });

      expect(store.dbQueries).toBe(3);
    });

    it('soma o tempo em dbMs sem marcar como lenta abaixo do limite', () => {
      const { queryLogger, logger } = makeLogger(200);
      const store = createRequestStore('req-1');

      runWithRequestStore(store, () => queryLogger.logQuerySlow(150, 'SELECT 1'));

      expect(store.dbMs).toBe(150);
      expect(store.slowQueries).toBe(0);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('acima do limite incrementa slowQueries e loga', () => {
      const { queryLogger, logger } = makeLogger(200);
      const store = createRequestStore('req-1');

      runWithRequestStore(store, () => queryLogger.logQuerySlow(250, 'SELECT 1'));

      expect(store.dbMs).toBe(250);
      expect(store.slowQueries).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('slow query 250ms'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('requestId=req-1'));
    });

    it('o log da query lenta NÃO contém os parâmetros (LGPD)', () => {
      const { queryLogger, logger } = makeLogger(200);
      const store = createRequestStore('req-1');

      runWithRequestStore(store, () =>
        // A assinatura do TypeORM entrega os parâmetros; nós ignoramos de propósito.
        (queryLogger.logQuerySlow as (t: number, q: string, p?: unknown[]) => void)(
          250,
          SELECT_WITH_PARAMS,
          PARAMS,
        ),
      );

      const logged = logger.warn.mock.calls[0][0] as string;
      expect(logged).toContain('SELECT * FROM residents');
      expect(logged).not.toContain('12345678900');
      expect(logged).not.toContain('Fulano de Tal');
    });

    it('erro de query loga sem os parâmetros (LGPD)', () => {
      const { queryLogger, logger } = makeLogger();
      const store = createRequestStore('req-9');

      runWithRequestStore(store, () =>
        (queryLogger.logQueryError as (e: Error, q: string, p?: unknown[]) => void)(
          new Error('duplicate key'),
          SELECT_WITH_PARAMS,
          PARAMS,
        ),
      );

      const logged = logger.error.mock.calls[0][0] as string;
      expect(logged).toContain('duplicate key');
      expect(logged).toContain('requestId=req-9');
      expect(logged).not.toContain('12345678900');
    });

    it('erro em string também é aceito', () => {
      const { queryLogger, logger } = makeLogger();
      queryLogger.logQueryError('boom', 'SELECT 1');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });
  });

  describe('demais callbacks do TypeORM', () => {
    it('logSchemaBuild é no-op', () => {
      const { queryLogger, logger } = makeLogger();
      expect(() => queryLogger.logSchemaBuild()).not.toThrow();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logMigration loga a mensagem', () => {
      const { queryLogger, logger } = makeLogger();
      queryLogger.logMigration('CreateFoo1700000000000 executada');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('CreateFoo1700000000000'),
      );
    });

    it('log só repassa o nível warn', () => {
      const { queryLogger, logger } = makeLogger();
      queryLogger.log('info', 'ignorada');
      queryLogger.log('log', 'ignorada');
      expect(logger.warn).not.toHaveBeenCalled();

      queryLogger.log('warn', 'atenção');
      expect(logger.warn).toHaveBeenCalledWith('atenção');
    });

    it('trunca query gigante no log', () => {
      const { queryLogger, logger } = makeLogger(10);
      queryLogger.logQuerySlow(50, `SELECT ${'x'.repeat(1000)}`);
      const logged = logger.warn.mock.calls[0][0] as string;
      expect(logged.length).toBeLessThan(400);
      expect(logged).toContain('…');
    });
  });

  describe('configuração', () => {
    it('sem opções, lê DB_SLOW_QUERY_MS do ambiente', () => {
      const previous = process.env.DB_SLOW_QUERY_MS;
      process.env.DB_SLOW_QUERY_MS = '10';
      try {
        const queryLogger = new QueryLogger({ logger: { warn: jest.fn(), error: jest.fn() } });
        const store = createRequestStore('req-env');
        runWithRequestStore(store, () => queryLogger.logQuerySlow(5, 'SELECT 1'));
        expect(store.slowQueries).toBe(0);
        runWithRequestStore(store, () => queryLogger.logQuerySlow(50, 'SELECT 1'));
        expect(store.slowQueries).toBe(1);
      } finally {
        if (previous === undefined) delete process.env.DB_SLOW_QUERY_MS;
        else process.env.DB_SLOW_QUERY_MS = previous;
      }
    });
  });
});
