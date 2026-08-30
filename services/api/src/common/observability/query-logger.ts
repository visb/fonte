import { Logger as NestLogger } from '@nestjs/common';
import type { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { requestContext } from './request-context';

/**
 * `Logger` do TypeORM que atribui o custo de banco à requisição em curso
 * (story 191).
 *
 * Por que um logger custom e não `logging: true`: o TypeORM chama os callbacks
 * do logger SEMPRE — quem decide imprimir é a implementação. Com esta classe
 * registrada, `logQuery` vira apenas um `++` num contador; o log verboso do
 * TypeORM continua desligado (nada é impresso por query).
 *
 * Fora de uma requisição (scheduler, seed, migration, boot) não há store: todo
 * método vira no-op. Nunca lança.
 */

/** Default de `DB_SLOW_QUERY_MS`: acima disso a query é "lenta" e vai ao log. */
export const DEFAULT_DB_SLOW_QUERY_MS = 200;

/** Corta a query no log — evita despejar SQL gigante no stdout do VPS. */
const MAX_QUERY_CHARS = 300;

export interface QueryLoggerOptions {
  /** Limite em ms para considerar a query lenta (default 200). */
  slowQueryMs?: number;
  /** Injetável para teste. */
  logger?: Pick<NestLogger, 'warn' | 'error'>;
}

export class QueryLogger implements TypeOrmLogger {
  private readonly slowQueryMs: number;
  private readonly logger: Pick<NestLogger, 'warn' | 'error'>;

  constructor(options: QueryLoggerOptions = {}) {
    this.slowQueryMs =
      options.slowQueryMs ?? Number(process.env.DB_SLOW_QUERY_MS ?? DEFAULT_DB_SLOW_QUERY_MS);
    this.logger = options.logger ?? new NestLogger('QueryLogger');
  }

  logQuery(): void {
    const store = requestContext.getStore();
    if (!store) return;
    store.dbQueries += 1;
  }

  /**
   * Único ponto em que o TypeORM entrega DURAÇÃO de query — só é chamado para
   * queries acima de `maxQueryExecutionTime` (=1ms em `database.config.ts`).
   * Queries sub-milissegundo, portanto, contam mas não somam tempo.
   */
  logQuerySlow(time: number, query: string): void {
    const store = requestContext.getStore();
    if (store) {
      store.dbMs += time;
    }
    if (time <= this.slowQueryMs) return;
    if (store) store.slowQueries += 1;
    // LGPD: os PARÂMETROS carregam CPF, nome, telefone — nunca vão para o log.
    this.logger.warn(
      `slow query ${Math.round(time)}ms requestId=${store?.requestId ?? '-'} ${truncate(query)}`,
    );
  }

  logQueryError(error: string | Error, query: string): void {
    const store = requestContext.getStore();
    const message = error instanceof Error ? error.message : error;
    // Sem parâmetros, mesma razão de LGPD do log de query lenta.
    this.logger.error(
      `query error requestId=${store?.requestId ?? '-'} ${message} :: ${truncate(query)}`,
    );
  }

  logSchemaBuild(): void {
    // Sem interesse operacional: roda só em sync/migration, fora de requisição.
  }

  logMigration(message: string): void {
    this.logger.warn(`migration ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown, _queryRunner?: QueryRunner): void {
    if (level === 'warn') this.logger.warn(String(message));
  }
}

function truncate(query: string): string {
  const flat = query.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_QUERY_CHARS ? `${flat.slice(0, MAX_QUERY_CHARS)}…` : flat;
}
