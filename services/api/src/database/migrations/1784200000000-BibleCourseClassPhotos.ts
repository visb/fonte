import { MigrationInterface, QueryRunner } from 'typeorm';

export class BibleCourseClassPhotos1784200000000 implements MigrationInterface {
  name = 'BibleCourseClassPhotos1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bible_course_class_photos" (
        "id"                  UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "class_id"            UUID         NOT NULL,
        "file_url"            TEXT         NOT NULL,
        "file_name"           TEXT         NOT NULL,
        "mime_type"           VARCHAR(128) NOT NULL,
        "size_bytes"          INTEGER      NOT NULL,
        "created_by_user_id"  UUID         NOT NULL,
        "created_at"          TIMESTAMP    NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        CONSTRAINT "PK_bible_course_class_photos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bible_course_class_photos_class"
          FOREIGN KEY ("class_id") REFERENCES "bible_course_classes" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bible_course_class_photos_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_bible_course_class_photos_class_id" ON "bible_course_class_photos" ("class_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bible_course_class_photos_class_id"`,
    );
    await queryRunner.query(`DROP TABLE "bible_course_class_photos"`);
  }
}
