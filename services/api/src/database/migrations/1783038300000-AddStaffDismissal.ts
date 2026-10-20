import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 217 — desligamento (e reintegração) de servo.
 *
 * - `staff.dismissed_at` (date, nula): data do desligamento. Servo **ativo** =
 *   `deleted_at IS NULL AND dismissed_at IS NULL`. O cadastro desligado continua
 *   visível (filtro "Desligados"), sem soft delete.
 * - `staff_service_periods.end_reason` (enum `StaffDismissalReason`, nulo) e
 *   `end_notes` (text, nulo): motivo do desligamento, gravado no período que ele
 *   encerrou. Período encerrado à mão (story 216) fica sem motivo.
 *
 * Sem backfill: staff soft-deletado antes desta story continua oculto (decisão 10).
 */
export class AddStaffDismissal1783038300000 implements MigrationInterface {
  name = 'AddStaffDismissal1783038300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dismissed_at date NULL`);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE public.staff_service_periods_end_reason_enum AS ENUM (
          'OWN_REQUEST', 'COORDINATION_DECISION', 'TRANSFER_OTHER_WORK', 'DEATH', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE public.staff_service_periods
        ADD COLUMN IF NOT EXISTS end_reason public.staff_service_periods_end_reason_enum NULL,
        ADD COLUMN IF NOT EXISTS end_notes text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.staff_service_periods DROP COLUMN IF EXISTS end_notes`);
    await queryRunner.query(`ALTER TABLE public.staff_service_periods DROP COLUMN IF EXISTS end_reason`);
    await queryRunner.query(`DROP TYPE IF EXISTS public.staff_service_periods_end_reason_enum`);
    await queryRunner.query(`ALTER TABLE public.staff DROP COLUMN IF EXISTS dismissed_at`);
  }
}
