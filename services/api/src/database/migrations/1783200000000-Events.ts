import { MigrationInterface, QueryRunner } from 'typeorm';

export class Events1783200000000 implements MigrationInterface {
  name = 'Events1783200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id"                      UUID                        NOT NULL DEFAULT uuid_generate_v4(),
        "title"                   VARCHAR                     NOT NULL,
        "description"             TEXT                        NOT NULL,
        "start_at"                TIMESTAMP WITH TIME ZONE     NOT NULL,
        "end_at"                  TIMESTAMP WITH TIME ZONE,
        "location"                VARCHAR,
        "capacity"                INTEGER,
        "banner_key"              VARCHAR,
        "registration_opens_at"   TIMESTAMP WITH TIME ZONE,
        "registration_closes_at"  TIMESTAMP WITH TIME ZONE,
        "created_at"              TIMESTAMP                   NOT NULL DEFAULT now(),
        "updated_at"              TIMESTAMP                   NOT NULL DEFAULT now(),
        "deleted_at"              TIMESTAMP,
        CONSTRAINT "PK_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_events_start_at" ON "events" ("start_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_events_start_at"`);
    await queryRunner.query(`DROP TABLE "events"`);
  }
}
