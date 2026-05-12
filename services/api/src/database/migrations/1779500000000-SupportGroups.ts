import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupportGroups1779500000000 implements MigrationInterface {
  name = 'SupportGroups1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_groups" (
        "id"             uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "name"           varchar     NOT NULL,
        "church_name"    varchar     NOT NULL,
        "address"        varchar     NOT NULL,
        "coordinator_id" uuid,
        "day_of_week"    smallint    NOT NULL,
        "created_at"     TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP   NOT NULL DEFAULT now(),
        "deleted_at"     TIMESTAMP,
        CONSTRAINT "PK_support_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_support_groups_coordinator"
          FOREIGN KEY ("coordinator_id") REFERENCES "staff"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "support_group_meetings" (
        "id"               uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "support_group_id" uuid        NOT NULL,
        "date"             date        NOT NULL,
        "notes"            text,
        "checkin_token"    uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"       TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_group_meetings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_support_group_meetings_token" UNIQUE ("checkin_token"),
        CONSTRAINT "FK_support_group_meetings_group"
          FOREIGN KEY ("support_group_id") REFERENCES "support_groups"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "support_group_checkins" (
        "id"             uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "meeting_id"     uuid        NOT NULL,
        "resident_id"    uuid        NOT NULL,
        "checked_in_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_at"     TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_group_checkins" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_support_group_checkins" UNIQUE ("meeting_id", "resident_id"),
        CONSTRAINT "FK_support_group_checkins_meeting"
          FOREIGN KEY ("meeting_id") REFERENCES "support_group_meetings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_support_group_checkins_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "support_group_checkins"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_group_meetings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_groups"`);
  }
}
