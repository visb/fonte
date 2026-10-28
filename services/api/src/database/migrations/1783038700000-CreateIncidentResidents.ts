import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 227 — ocorrência com múltiplos filhos envolvidos.
 *
 * - `incident_residents`: junção ocorrência × filho, PK composta, índice em
 *   `resident_id` (filtro `GET /incidents?residentId=` e a ficha do filho).
 * - Backfill: toda ocorrência que tinha `incidents.resident_id` ganha a linha
 *   correspondente na junção — o filho da ocorrência antiga é preservado.
 * - Drop de `incidents.resident_id` (a junção passa a ser a única fonte).
 *
 * `down` recria a coluna e repopula com o PRIMEIRO filho da junção (o modelo
 * antigo só comporta um; os demais se perdem no rollback).
 */
export class CreateIncidentResidents1783038700000 implements MigrationInterface {
  name = 'CreateIncidentResidents1783038700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.incident_residents (
        incident_id uuid NOT NULL,
        resident_id uuid NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_incident_residents" PRIMARY KEY (incident_id, resident_id),
        CONSTRAINT "FK_incident_residents_incident" FOREIGN KEY (incident_id)
          REFERENCES public.incidents(id) ON DELETE CASCADE,
        CONSTRAINT "FK_incident_residents_resident" FOREIGN KEY (resident_id)
          REFERENCES public.residents(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_incident_residents_resident"
        ON public.incident_residents (resident_id)
    `);
    await queryRunner.query(`
      INSERT INTO public.incident_residents (incident_id, resident_id, created_at)
      SELECT id, resident_id, created_at
        FROM public.incidents
       WHERE resident_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS "FK_incidents_resident"`);
    await queryRunner.query(`ALTER TABLE public.incidents DROP COLUMN IF EXISTS resident_id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS resident_id uuid NULL`);
    await queryRunner.query(`
      UPDATE public.incidents i
         SET resident_id = first_link.resident_id
        FROM (
          SELECT DISTINCT ON (incident_id) incident_id, resident_id
            FROM public.incident_residents
           ORDER BY incident_id, created_at ASC, resident_id ASC
        ) first_link
       WHERE first_link.incident_id = i.id
    `);
    await queryRunner.query(`
      ALTER TABLE public.incidents
        ADD CONSTRAINT "FK_incidents_resident" FOREIGN KEY (resident_id)
        REFERENCES public.residents(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_incident_residents_resident"`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.incident_residents`);
  }
}
