import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 67 — toggle de inscrição por evento.
 * Adiciona `events.registration_enabled` (boolean, default false). Eventos
 * existentes nascem `false` (consistente com o novo default só-divulgação);
 * eventos que devem continuar inscritíveis são religados manualmente pelo adm.
 * Aditiva, sem drop destrutivo.
 *
 * Timestamp 1783600000000: precisa rodar DEPOIS de Events1783200000000 (cria a
 * tabela `events`). IF NOT EXISTS/IF EXISTS deixam a migration idempotente.
 */
export class EventRegistrationEnabled1783600000000 implements MigrationInterface {
  name = 'EventRegistrationEnabled1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration_enabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "registration_enabled"`,
    );
  }
}
