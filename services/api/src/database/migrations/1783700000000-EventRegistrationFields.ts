import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 68 — campos de formulário de inscrição customizáveis.
 * Adiciona:
 *   - `events.registration_fields` JSONB NOT NULL DEFAULT '[]' — definição dos
 *     campos extras montados pelo admin por evento.
 *   - `event_registrations.answers` JSONB NOT NULL DEFAULT '{}' — respostas do
 *     inscrito aos campos custom (mapa fieldId → valor; `file` guarda a key).
 * Aditiva, sem drop destrutivo. IF NOT EXISTS/IF EXISTS deixam idempotente.
 *
 * Timestamp 1783700000000: precisa rodar DEPOIS de Events1783200000000 e
 * EventRegistrations1783300000000 (criam as tabelas) e da última migration
 * existente (EventRegistrationEnabled1783600000000).
 */
export class EventRegistrationFields1783700000000 implements MigrationInterface {
  name = 'EventRegistrationFields1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration_fields" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "answers" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "answers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "registration_fields"`,
    );
  }
}
