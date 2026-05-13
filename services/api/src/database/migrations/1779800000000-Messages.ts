import { MigrationInterface, QueryRunner } from 'typeorm';

export class Messages1779800000000 implements MigrationInterface {
  name = 'Messages1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."messages_status_enum" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')
    `);
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"                   UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"          UUID        NOT NULL,
        "relative_id"          UUID        NOT NULL,
        "sender_user_id"       UUID        NOT NULL,
        "content"              TEXT        NOT NULL,
        "status"               "public"."messages_status_enum" NOT NULL DEFAULT 'PENDING_APPROVAL',
        "approved_by_user_id"  UUID        NULL,
        "approved_at"          TIMESTAMP   NULL,
        "created_at"           TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_resident" FOREIGN KEY ("resident_id")
          REFERENCES "residents"("id"),
        CONSTRAINT "FK_messages_relative" FOREIGN KEY ("relative_id")
          REFERENCES "relatives"("id"),
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_user_id")
          REFERENCES "users"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "public"."messages_status_enum"`);
  }
}
