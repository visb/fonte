import { MigrationInterface, QueryRunner } from 'typeorm';

export class BibleCourseModules1782300000000 implements MigrationInterface {
  name = 'BibleCourseModules1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bible_course_modules" (
        "id"         uuid       NOT NULL DEFAULT uuid_generate_v4(),
        "name"       varchar    NOT NULL,
        "sequence"   integer    NOT NULL DEFAULT 0,
        "notes"      text,
        "created_at" TIMESTAMP  NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP  NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_bible_course_modules" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_modules"`);
  }
}
