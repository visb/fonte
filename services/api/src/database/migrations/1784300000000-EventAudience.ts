import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 94 — eventos internos.
 * Adiciona `events.audience` (varchar, default 'PUBLIC'). Eventos existentes
 * nascem `PUBLIC` (default + backfill explícito), preservando o comportamento
 * atual (todo evento era voltado ao público externo). `INTERNAL` = evento só
 * para servos, fora do portal público. Aditiva, sem drop destrutivo.
 *
 * Timestamp 1784300000000: roda DEPOIS de Events (cria a tabela `events`) e da
 * última migration da rodada (1784200000000-BibleCourseClassPhotos).
 * IF NOT EXISTS/IF EXISTS deixam a migration idempotente.
 */
export class EventAudience1784300000000 implements MigrationInterface {
  name = 'EventAudience1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "audience" varchar NOT NULL DEFAULT 'PUBLIC'`,
    );
    // Backfill explícito: garante que registros anteriores fiquem PUBLIC.
    await queryRunner.query(
      `UPDATE "events" SET "audience" = 'PUBLIC' WHERE "audience" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "audience"`,
    );
  }
}
