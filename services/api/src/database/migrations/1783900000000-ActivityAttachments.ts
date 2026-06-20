import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityAttachments1783900000000 implements MigrationInterface {
  name = 'ActivityAttachments1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_attachments" (
        "id"                  UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "activity_id"         UUID         NOT NULL,
        "comment_id"          UUID,
        "file_url"            TEXT         NOT NULL,
        "file_name"           TEXT         NOT NULL,
        "file_type"           VARCHAR(16)  NOT NULL,
        "mime_type"           VARCHAR(128) NOT NULL,
        "size_bytes"          INTEGER      NOT NULL,
        "created_by_user_id"  UUID         NOT NULL,
        "created_at"          TIMESTAMP    NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        CONSTRAINT "PK_activity_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activity_attachments_activity"
          FOREIGN KEY ("activity_id") REFERENCES "activities" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_attachments_comment"
          FOREIGN KEY ("comment_id") REFERENCES "activity_comments" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_attachments_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_activity_attachments_activity_id" ON "activity_attachments" ("activity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_attachments_comment_id" ON "activity_attachments" ("comment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_activity_attachments_comment_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_activity_attachments_activity_id"`,
    );
    await queryRunner.query(`DROP TABLE "activity_attachments"`);
  }
}
