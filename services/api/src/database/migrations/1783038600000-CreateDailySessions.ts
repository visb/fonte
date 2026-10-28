import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 225 — módulo Daily (board de ministérios em tempo real).
 *
 * - `daily_sessions`: rascunho da daily de uma casa. `status` OPEN | APPLIED |
 *   DISCARDED; `version` sobe a cada movimento (o cliente detecta salto e refaz
 *   o GET). No máximo UMA sessão OPEN por casa — índice único parcial.
 * - `daily_session_assignments`: destino de cada pessoa no board.
 *   `ministry_id` nulo = "Sem ministério". Uma linha por pessoa por sessão.
 *
 * Dado efêmero de trabalho: sem soft delete (o histórico real fica na
 * auditoria dos ministérios; DISCARDED cobre o descarte).
 */
export class CreateDailySessions1783038600000 implements MigrationInterface {
  name = 'CreateDailySessions1783038600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.daily_sessions (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        house_id uuid NOT NULL,
        status varchar(10) NOT NULL DEFAULT 'OPEN',
        session_date date NOT NULL,
        version integer NOT NULL DEFAULT 0,
        created_by_user_id uuid NOT NULL,
        applied_at timestamptz NULL,
        applied_by_user_id uuid NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_sessions" PRIMARY KEY (id),
        CONSTRAINT "CHK_daily_sessions_status" CHECK (status IN ('OPEN', 'APPLIED', 'DISCARDED')),
        CONSTRAINT "FK_daily_sessions_house" FOREIGN KEY (house_id)
          REFERENCES public.houses(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UX_daily_sessions_open_house"
        ON public.daily_sessions (house_id)
        WHERE status = 'OPEN'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_daily_sessions_house_created"
        ON public.daily_sessions (house_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.daily_session_assignments (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL,
        person_type varchar(10) NOT NULL,
        person_id uuid NOT NULL,
        ministry_id uuid NULL,
        updated_by_user_id uuid NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_session_assignments" PRIMARY KEY (id),
        CONSTRAINT "CHK_daily_session_assignments_type" CHECK (person_type IN ('RESIDENT', 'STAFF')),
        CONSTRAINT "UQ_daily_session_assignments_person" UNIQUE (session_id, person_type, person_id),
        CONSTRAINT "FK_daily_session_assignments_session" FOREIGN KEY (session_id)
          REFERENCES public.daily_sessions(id) ON DELETE CASCADE,
        CONSTRAINT "FK_daily_session_assignments_ministry" FOREIGN KEY (ministry_id)
          REFERENCES public.ministries(id) ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.daily_session_assignments`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_daily_sessions_house_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."UX_daily_sessions_open_house"`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.daily_sessions`);
  }
}
