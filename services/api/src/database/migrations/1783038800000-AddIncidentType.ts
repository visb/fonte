import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 229 — ocorrência positiva/negativa (substitui a severidade).
 *
 * - Enum `incident_type` (`POSITIVE`, `NEGATIVE`) + coluna `incidents.type NOT NULL`.
 *   A coluna nasce com default `NEGATIVE` só para o backfill (toda ocorrência
 *   antiga foi registrada como problema) e o default é removido em seguida — o
 *   tipo passa a ser sempre informado.
 * - Drop de `incidents.severity` e do enum `incident_severity_enum`: a
 *   severidade histórica é descartada (decisão da story).
 *
 * `down` recria `severity` com `MEDIUM` em todas as linhas e remove `type`.
 */
export class AddIncidentType1783038800000 implements MigrationInterface {
  name = 'AddIncidentType1783038800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE public.incident_type AS ENUM ('POSITIVE', 'NEGATIVE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS type public.incident_type NOT NULL DEFAULT 'NEGATIVE'`,
    );
    await queryRunner.query(`ALTER TABLE public.incidents ALTER COLUMN type DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE public.incidents DROP COLUMN IF EXISTS severity`);
    await queryRunner.query(`DROP TYPE IF EXISTS public.incident_severity_enum`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE public.incident_severity_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS severity public.incident_severity_enum NOT NULL DEFAULT 'MEDIUM'`,
    );
    await queryRunner.query(`ALTER TABLE public.incidents ALTER COLUMN severity DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE public.incidents DROP COLUMN IF EXISTS type`);
    await queryRunner.query(`DROP TYPE IF EXISTS public.incident_type`);
  }
}
