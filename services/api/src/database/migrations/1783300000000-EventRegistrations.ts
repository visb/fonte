import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventRegistrations1783300000000 implements MigrationInterface {
  name = 'EventRegistrations1783300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_registrations" (
        "id"          UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "event_id"    UUID         NOT NULL,
        "name"        VARCHAR      NOT NULL,
        "contact"     VARCHAR      NOT NULL,
        "email"       VARCHAR,
        "created_at"  TIMESTAMP    NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMP,
        CONSTRAINT "PK_event_registrations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_registrations_event"
          FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_event_registrations_event_id" ON "event_registrations" ("event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_event_registrations_event_id"`);
    await queryRunner.query(`DROP TABLE "event_registrations"`);
  }
}
