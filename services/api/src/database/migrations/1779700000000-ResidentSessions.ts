import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentSessions1779700000000 implements MigrationInterface {
  name = 'ResidentSessions1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "resident_usage_sessions" (
        "id"           UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"  UUID          NOT NULL,
        "date"         DATE          NOT NULL,
        "seconds_used" INTEGER       NOT NULL DEFAULT 0,
        "updated_at"   TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resident_usage_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_resident_usage_sessions_resident_date" UNIQUE ("resident_id", "date"),
        CONSTRAINT "FK_resident_usage_sessions_resident" FOREIGN KEY ("resident_id")
          REFERENCES "residents"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "resident_usage_sessions"`);
  }
}
