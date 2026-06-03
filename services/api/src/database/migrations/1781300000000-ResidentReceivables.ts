import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentReceivables1781300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "residents"
        ADD COLUMN "contribution_exempt" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TYPE "receivable_status_enum" AS ENUM ('PENDING', 'PAID', 'CANCELED')
    `);

    await queryRunner.query(`
      CREATE TYPE "payment_method_enum" AS ENUM
        ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BASKET', 'OTHER')
    `);

    await queryRunner.query(`
      CREATE TABLE "resident_receivables" (
        "id"                uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"       uuid        NOT NULL,
        "reference_month"   date        NOT NULL,
        "due_date"          date        NOT NULL,
        "amount"            integer     NOT NULL,
        "family_investment" "family_investment_enum" NOT NULL,
        "mandatory"         boolean     NOT NULL DEFAULT true,
        "status"            "receivable_status_enum" NOT NULL DEFAULT 'PENDING',
        "paid_at"           date        NULL,
        "payment_method"    "payment_method_enum"    NULL,
        "attachment_url"    varchar     NULL,
        "notes"             text        NULL,
        "created_by_id"     uuid        NULL,
        "created_at"        TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP   NOT NULL DEFAULT now(),
        "deleted_at"        TIMESTAMP   NULL,
        CONSTRAINT "PK_resident_receivables" PRIMARY KEY ("id"),
        CONSTRAINT "FK_receivables_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_receivables_staff"
          FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_receivables_resident_id" ON "resident_receivables" ("resident_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_receivables_resident_month"
        ON "resident_receivables" ("resident_id", "reference_month")
        WHERE "deleted_at" IS NULL
    `);

    // Seed the carnê for current active paying residents: only current and future
    // mandatory months (no past months → avoids false "atrasado"; "começar do zero").
    await queryRunner.query(`
      INSERT INTO "resident_receivables"
        ("resident_id", "reference_month", "due_date", "amount", "family_investment", "mandatory", "status")
      SELECT
        r.id,
        m.ref_month,
        (date_trunc('month', m.ref_month)
          + (LEAST(
                COALESCE(r.contribution_due_day, EXTRACT(DAY FROM r.entry_date)::int),
                EXTRACT(DAY FROM (date_trunc('month', m.ref_month) + INTERVAL '1 month - 1 day'))::int
             ) - 1) * INTERVAL '1 day')::date,
        COALESCE(
          r.family_investment_amount,
          CASE r.family_investment
            WHEN 'BASKET_500' THEN 500
            WHEN 'PAYMENT_700' THEN 700
            ELSE 0
          END
        ),
        r.family_investment,
        true,
        'PENDING'
      FROM residents r
      CROSS JOIN LATERAL generate_series(0, 5) AS offs
      CROSS JOIN LATERAL (
        SELECT (date_trunc('month', r.entry_date) + (offs || ' month')::interval)::date AS ref_month
      ) m
      WHERE r.deleted_at IS NULL
        AND r.entry_date IS NOT NULL
        AND r.family_investment IS NOT NULL
        AND r.family_investment != 'SOCIAL'
        AND r.contribution_exempt = false
        AND r.status IN ('PRE_ADMISSION', 'ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE')
        AND m.ref_month >= date_trunc('month', CURRENT_DATE)::date
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_receivables_resident_month"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_receivables_resident_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_receivables"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "receivable_status_enum"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "contribution_exempt"`);
  }
}
