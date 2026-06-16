import { MigrationInterface, QueryRunner } from 'typeorm';

export class BibleCourseGrades1782400000000 implements MigrationInterface {
  name = 'BibleCourseGrades1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bible_course_grades" (
        "id"            uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "enrollment_id" uuid          NOT NULL,
        "module_id"     uuid          NOT NULL,
        "exam_grade"    numeric(4,2),
        "work_grade"    numeric(4,2),
        "created_at"    TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP     NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMP,
        CONSTRAINT "PK_bible_course_grades" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bible_course_grades" UNIQUE ("enrollment_id", "module_id"),
        CONSTRAINT "FK_bible_course_grades_enrollment"
          FOREIGN KEY ("enrollment_id") REFERENCES "bible_course_enrollments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bible_course_grades_module"
          FOREIGN KEY ("module_id") REFERENCES "bible_course_modules"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_grades"`);
  }
}
