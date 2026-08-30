import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObservabilityController } from './observability.controller';
import {
  DEFAULT_SLOW_REQUEST_MS,
  OBSERVABILITY_OPTIONS,
  ObservabilityMiddleware,
  ObservabilityOptions,
} from './observability.middleware';
import { METRICS_STORE_OPTIONS, MetricsStore, MetricsStoreOptions } from './metrics.store';
import { RuntimeService } from './runtime.service';

/**
 * Story 191 — instrumentação de custo por requisição.
 *
 * O módulo é `NestModule` e aplica o middleware em TODAS as rotas; por isso
 * precisa entrar ANTES dos módulos de feature na lista de `imports` do
 * `AppModule` (a ordem de registro é a ordem da cadeia de middlewares).
 */
@Module({
  controllers: [ObservabilityController],
  providers: [
    {
      provide: METRICS_STORE_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MetricsStoreOptions => ({
        recentSize: Number(config.get('OBSERVABILITY_RECENT_SIZE') ?? 200),
        maxRoutes: Number(config.get('OBSERVABILITY_MAX_ROUTES') ?? 300),
      }),
    },
    {
      provide: OBSERVABILITY_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ObservabilityOptions => ({
        slowRequestMs: Number(
          config.get('OBSERVABILITY_SLOW_REQUEST_MS') ?? DEFAULT_SLOW_REQUEST_MS,
        ),
        logRequests: config.get('OBSERVABILITY_LOG_REQUESTS') === 'true',
      }),
    },
    MetricsStore,
    RuntimeService,
  ],
  exports: [MetricsStore, RuntimeService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ObservabilityMiddleware).forRoutes('*');
  }
}
