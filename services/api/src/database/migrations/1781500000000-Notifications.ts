import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1781500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'ADMISSION_CREATED',
        'PAYMENT_REGISTERED',
        'INCIDENT_CREATED',
        'RESIDENT_DISCHARGED',
        'RECEIVABLE_OVERDUE',
        'ROUTINE_MISSING',
        'REQUIRED_DOC_MISSING'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"             uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_id"   uuid        NULL,
        "recipient_role" "public"."users_role_enum" NULL,
        "house_id"       uuid        NULL,
        "type"           "notification_type_enum" NOT NULL,
        "title"          varchar     NOT NULL,
        "body"           text        NULL,
        "link"           varchar     NULL,
        "metadata"       jsonb       NULL,
        "created_at"     TIMESTAMP   NOT NULL DEFAULT now(),
        "deleted_at"     TIMESTAMP   NULL,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_role" ON "notifications" ("recipient_role")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_house_id" ON "notifications" ("house_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_id" ON "notifications" ("recipient_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_reads" (
        "id"              uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "notification_id" uuid        NOT NULL,
        "user_id"         uuid        NOT NULL,
        "read_at"         TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_reads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_reads_notification"
          FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notification_reads_notification_user"
        ON "notification_reads" ("notification_id", "user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_notification_reads_notification_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_reads"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_recipient_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_house_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_recipient_role"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
