import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { QueryLogger } from '../common/observability/query-logger';

export const getDatabaseConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: config.get<string>('DATABASE_URL'),
  autoLoadEntities: true,
  synchronize: false,
  migrations: ['dist/database/migrations/*.js'],
  // Observabilidade (story 191). O logger custom recebe os callbacks do TypeORM
  // direto e só INCREMENTA contadores — `logging` continua desligado, ou seja,
  // nada de log verboso por query. `maxQueryExecutionTime: 1` é o único jeito
  // de o TypeORM entregar a DURAÇÃO da query (callback `logQuerySlow`); o que
  // define o que vai para o log de query lenta é `DB_SLOW_QUERY_MS` (200ms).
  logger: new QueryLogger(),
  maxQueryExecutionTime: 1,
});
