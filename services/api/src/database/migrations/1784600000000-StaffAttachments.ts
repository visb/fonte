import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffAttachments1784600000000 implements MigrationInterface {
  name = 'StaffAttachments1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "staff_attachments" (
        "id"                  UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "staff_id"            UUID         NOT NULL,
        "file_url"            TEXT         NOT NULL,
        "file_name"           TEXT         NOT NULL,
        "mime_type"           VARCHAR(128) NOT NULL,
        "size_bytes"          INTEGER      NOT NULL,
        "created_by_user_id"  UUID         NOT NULL,
        "created_at"          TIMESTAMP    NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        CONSTRAINT "PK_staff_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_staff_attachments_staff"
          FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_staff_attachments_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_staff_attachments_staff_id" ON "staff_attachments" ("staff_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_staff_attachments_staff_id"`,
    );
    await queryRunner.query(`DROP TABLE "staff_attachments"`);
  }
}
