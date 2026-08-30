import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { MetricsStore, RecentRequest, RouteStats } from './metrics.store';
import { RuntimeService, RuntimeSnapshot } from './runtime.service';

/**
 * Janela viva do processo (story 191) — não é dashboard histórico: o agregado
 * vale desde o boot (ou desde o último `reset`) e morre no restart. Histórico
 * é o Sentry.
 */

export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSec: number;
  db: 'up' | 'down';
}

export interface StatsResponse {
  /** Início da janela do agregado (boot ou último `reset`). */
  startedAt: string;
  runtime: RuntimeSnapshot;
  routes: RouteStats[];
  recent: RecentRequest[];
}

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly metrics: MetricsStore,
    private readonly runtime: RuntimeService,
  ) {}

  /**
   * PÚBLICA de propósito: é o liveness do healthcheck do compose e do nginx.
   * Justamente por isso NÃO expõe memória, versão, contagem de rotas nem nada
   * que ajude quem está sondando o host.
   */
  @Get('health')
  async health(): Promise<HealthResponse> {
    const db = await this.runtime.checkDatabase();
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      uptimeSec: Math.round(process.uptime()),
      db,
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  stats(): StatsResponse {
    return {
      startedAt: this.metrics.getStartedAt(),
      runtime: this.runtime.snapshot(),
      routes: this.metrics.getRoutes(),
      recent: this.metrics.getRecent(),
    };
  }

  /** Zera a janela — medir um cenário específico sem reiniciar a API. */
  @Post('reset')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  reset(): { startedAt: string } {
    this.metrics.reset();
    this.runtime.reset();
    return { startedAt: this.metrics.getStartedAt() };
  }
}
