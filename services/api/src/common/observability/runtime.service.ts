import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import { DataSource } from 'typeorm';

/**
 * Saúde do processo (story 191).
 *
 * Em 1 vCPU, **lag de event loop é o sinal mais importante**: é ele que
 * denuncia o Puppeteer gerando PDF, o `sharp` gerando thumbnail ou o `pg_dump`
 * do backup travando o processo — coisas que nenhuma métrica por rota mostra.
 *
 * Sem `setInterval` de coleta: tudo é lido SOB DEMANDA no request do
 * controller. Timer em 1 vCPU é custo permanente para dado que ninguém está
 * olhando. O único custo contínuo é o histograma do `monitorEventLoopDelay`,
 * que roda em C++ fora do event loop.
 */

/** Timeout do `SELECT 1` do health — liveness não pode ficar pendurado. */
const DB_PING_TIMEOUT_MS = 2000;

export interface EventLoopLag {
  p50: number;
  p99: number;
  max: number;
}

export interface RuntimeSnapshot {
  uptimeSec: number;
  eventLoopLagMs: EventLoopLag;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  /** % de CPU do processo desde o último `snapshot()` (janela móvel). */
  cpuPercent: number;
  nodeVersion: string;
}

function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

/**
 * Nanossegundos → ms. O histograma devolve `Infinity` quando ainda não há
 * amostra na janela (logo após um `reset`), e `Infinity` no JSON vira `null` —
 * a tela mostraria um buraco. Zero é a leitura honesta de "sem amostra".
 */
export function nsToMs(nanoseconds: number): number {
  if (!Number.isFinite(nanoseconds)) return 0;
  return Math.round((nanoseconds / 1e6) * 100) / 100;
}

@Injectable()
export class RuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly histogram: IntervalHistogram = monitorEventLoopDelay({ resolution: 10 });
  private lastCpuUsage = process.cpuUsage();
  private lastCpuSampleAt = Date.now();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    this.histogram.enable();
  }

  onModuleDestroy(): void {
    this.histogram.disable();
  }

  /** Foto do processo agora. Também fecha a janela de CPU. */
  snapshot(): RuntimeSnapshot {
    const memory = process.memoryUsage();
    return {
      uptimeSec: Math.round(process.uptime()),
      eventLoopLagMs: {
        p50: nsToMs(this.histogram.percentile(50)),
        p99: nsToMs(this.histogram.percentile(99)),
        max: nsToMs(this.histogram.max),
      },
      memory: {
        rssMb: toMb(memory.rss),
        heapUsedMb: toMb(memory.heapUsed),
        heapTotalMb: toMb(memory.heapTotal),
        externalMb: toMb(memory.external),
      },
      cpuPercent: this.sampleCpuPercent(),
      nodeVersion: process.version,
    };
  }

  /**
   * CPU consumida desde a leitura anterior, em % do tempo de parede. Num VPS de
   * 1 vCPU o teto prático é 100%; em máquina com mais núcleos pode passar.
   */
  private sampleCpuPercent(): number {
    const now = Date.now();
    const delta = process.cpuUsage(this.lastCpuUsage);
    const elapsedMs = now - this.lastCpuSampleAt;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuSampleAt = now;
    if (elapsedMs <= 0) return 0;
    const cpuMs = (delta.user + delta.system) / 1000;
    return Math.round((cpuMs / elapsedMs) * 100 * 100) / 100;
  }

  /** `SELECT 1` com timeout curto. NUNCA lança — health não pode quebrar. */
  async checkDatabase(): Promise<'up' | 'down'> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('db ping timeout')), DB_PING_TIMEOUT_MS);
          timer.unref?.();
        }),
      ]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Reinicia a janela do histograma e a base do cálculo de CPU. */
  reset(): void {
    this.histogram.reset();
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuSampleAt = Date.now();
  }
}
