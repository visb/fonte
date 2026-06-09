import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DataRightsService } from '../data-rights/data-rights.service';

// LGPD art. 15/16 — descarte após o prazo de retenção. Anonimiza internos com
// soft delete mais antigo que o prazo configurado. Idempotente: pula quem já
// foi anonimizado (name = 'Titular anonimizado').
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly dataRights: DataRightsService,
    private readonly config: ConfigService,
  ) {}

  private get retentionDays(): number {
    const v = Number(this.config.get('LGPD_RETENTION_DAYS'));
    return Number.isFinite(v) && v > 0 ? v : 1825; // default ~5 anos
  }

  private get enabled(): boolean {
    return String(this.config.get('LGPD_RETENTION_ENABLED') ?? 'false') === 'true';
  }

  async findExpiredResidentIds(): Promise<string[]> {
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM residents
        WHERE deleted_at IS NOT NULL
          AND deleted_at < now() - ($1 || ' days')::interval
          AND name <> 'Titular anonimizado'`,
      [String(this.retentionDays)],
    );
    return rows.map((r) => r.id);
  }

  // Anonimiza todos os internos expirados. Retorna a contagem processada.
  async purgeExpired(): Promise<{ anonymized: number }> {
    const ids = await this.findExpiredResidentIds();
    let anonymized = 0;
    for (const id of ids) {
      try {
        await this.dataRights.anonymizeResident(id);
        anonymized++;
      } catch (error) {
        this.logger.warn(
          `Falha ao anonimizar interno expirado ${id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    if (anonymized > 0) this.logger.log(`Retenção LGPD: ${anonymized} interno(s) anonimizado(s).`);
    return { anonymized };
  }

  @Cron(CronExpression.EVERY_WEEK)
  async scheduledPurge(): Promise<void> {
    if (!this.enabled) return;
    await this.purgeExpired();
  }
}
