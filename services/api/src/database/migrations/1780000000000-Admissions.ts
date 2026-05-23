import { MigrationInterface, QueryRunner } from 'typeorm';

export class Admissions1780000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admissions" (
        "id"                    uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"           uuid      NOT NULL,
        "house_id"              uuid      NOT NULL,
        "ministry_id"           uuid      NULL,
        "entry_date"            date      NULL,
        "exit_date"             date      NULL,
        "status"                varchar   NOT NULL,
        "health_issues"         varchar   NULL,
        "continuous_medication" varchar   NULL,
        "weight"                integer   NULL,
        "height"                integer   NULL,
        "family_investment"     varchar   NULL,
        "created_at"            TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_admissions_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "admissions" (
        "id", "resident_id", "house_id", "ministry_id",
        "entry_date", "exit_date", "status",
        "health_issues", "continuous_medication",
        "weight", "height", "family_investment",
        "created_at", "updated_at"
      )
      SELECT
        uuid_generate_v4(), "id", "house_id", NULLIF("ministry_id"::text, '')::uuid,
        "entry_date", "exit_date", "status"::varchar,
        "health_issues", "continuous_medication",
        "weight", "height", "family_investment",
        now(), now()
      FROM "residents"
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_email"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_email_active"
        ON "users"("email")
        WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email_active"`);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")
    `);

    await queryRunner.query(`DROP TABLE "admissions"`);
  }
}
