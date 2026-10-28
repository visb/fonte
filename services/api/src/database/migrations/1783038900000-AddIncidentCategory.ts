import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 230 — categoria da ocorrência.
 *
 * - Enum `incident_category` + coluna `incidents.category` NULLABLE, sem
 *   backfill: ocorrências anteriores à story ficam "Sem categoria".
 * - A coerência categoria × tipo é regra de aplicação (service), não do banco.
 *
 * `down` dropa a coluna e o enum.
 */
export class AddIncidentCategory1783038900000 implements MigrationInterface {
  name = 'AddIncidentCategory1783038900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE public.incident_category AS ENUM (
          'AGGRESSION', 'DISRESPECT', 'EVASION', 'SUBSTANCE_USE', 'ACTIVITY_REFUSAL',
          'PROPERTY_DAMAGE', 'HEALTH', 'GOOD_BEHAVIOR', 'HELPING_OTHERS',
          'ACTIVITY_HIGHLIGHT', 'SPIRITUAL_LIFE', 'TREATMENT_PROGRESS', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS category public.incident_category NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.incidents DROP COLUMN IF EXISTS category`);
    await queryRunner.query(`DROP TYPE IF EXISTS public.incident_category`);
  }
}
