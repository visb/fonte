import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityEvents1783500000000 implements MigrationInterface {
  name = 'ActivityEvents1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "activity_events_type_enum" AS ENUM (
        'CREATED',
        'STATUS_CHANGED',
        'TITLE_CHANGED',
        'DESCRIPTION_CHANGED',
        'RESPONSIBLE_CHANGED',
        'COMMENTED',
        'DELETED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "activity_events" (
        "id"             UUID                          NOT NULL DEFAULT uuid_generate_v4(),
        "activity_id"    UUID                          NOT NULL,
        "type"           "activity_events_type_enum"   NOT NULL,
        "actor_user_id"  UUID                          NOT NULL,
        "metadata"       JSONB,
        "created_at"     TIMESTAMP                     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activity_events_activity"
          FOREIGN KEY ("activity_id") REFERENCES "activities" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_events_actor"
          FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_activity_events_activity_id" ON "activity_events" ("activity_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_activity_events_activity_id"`,
    );
    await queryRunner.query(`DROP TABLE "activity_events"`);
    await queryRunner.query(`DROP TYPE "activity_events_type_enum"`);
  }
}
