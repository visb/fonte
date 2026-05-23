import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentFollowUps1780001000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "follow_up_type_enum" AS ENUM (
        'ADMISSION', 'READMISSION', 'DISCHARGE', 'EVASION',
        'MINISTRY_CHANGE', 'RELATIVE_ADDED', 'DOCUMENT_ATTACHED',
        'MONTHLY_CONTRIBUTION', 'DISCIPLINE', 'BEHAVIOR_ASSESSMENT', 'NOTE'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "follow_up_access_level_enum" AS ENUM (
        'ALL', 'ADMINISTRATION'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resident_follow_ups" (
        "id"             uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"    uuid        NOT NULL,
        "date"           date        NOT NULL,
        "type"           "follow_up_type_enum"         NOT NULL,
        "description"    text        NULL,
        "access_level"   "follow_up_access_level_enum" NOT NULL DEFAULT 'ALL',
        "created_by_id"  uuid        NULL,
        "created_at"     TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP   NOT NULL DEFAULT now(),
        "deleted_at"     TIMESTAMP   NULL,
        CONSTRAINT "PK_resident_follow_ups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_follow_ups_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follow_ups_staff"
          FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_follow_ups_resident_id" ON "resident_follow_ups" ("resident_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_follow_ups_resident_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_follow_ups"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "follow_up_access_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "follow_up_type_enum"`);
  }
}
