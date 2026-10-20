import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 216 — período de serviço do servo (aba Histórico).
 *
 * - `staff_service_periods`: um registro por período em que o staff serviu;
 *   `end_date` nulo = em andamento. `house_id` nulo = servo sem casa (grupo de
 *   apoio). FK do staff em CASCADE; da casa em SET NULL.
 * - `UX_staff_service_periods_open`: no máximo um período ABERTO (e não
 *   excluído) por staff — índice único parcial (decisão 6).
 * - Backfill (decisão 3): um período aberto para cada staff não desligado
 *   (`deleted_at IS NULL`), com início = `promoted_at` ou, sem ele,
 *   `created_at::date`, e casa = `house_id` atual. Idempotente: não duplica
 *   para quem já tem período aberto.
 */
export class CreateStaffServicePeriods1783038200000 implements MigrationInterface {
  name = 'CreateStaffServicePeriods1783038200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.staff_service_periods (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        staff_id uuid NOT NULL,
        house_id uuid NULL,
        start_date date NOT NULL,
        end_date date NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP NULL,
        CONSTRAINT "PK_staff_service_periods" PRIMARY KEY (id),
        CONSTRAINT "FK_staff_service_periods_staff" FOREIGN KEY (staff_id)
          REFERENCES public.staff(id) ON DELETE CASCADE,
        CONSTRAINT "FK_staff_service_periods_house" FOREIGN KEY (house_id)
          REFERENCES public.houses(id) ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_staff_service_periods_staff"
        ON public.staff_service_periods (staff_id, start_date DESC)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UX_staff_service_periods_open"
        ON public.staff_service_periods (staff_id)
        WHERE end_date IS NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO public.staff_service_periods (staff_id, house_id, start_date)
      SELECT s.id, s.house_id, COALESCE(s.promoted_at, s.created_at::date)
        FROM public.staff s
       WHERE s.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.staff_service_periods p
            WHERE p.staff_id = s.id AND p.end_date IS NULL AND p.deleted_at IS NULL
         )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public."UX_staff_service_periods_open"`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_staff_service_periods_staff"`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.staff_service_periods`);
  }
}
