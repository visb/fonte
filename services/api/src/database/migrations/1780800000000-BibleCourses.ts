import { MigrationInterface, QueryRunner } from 'typeorm';

export class BibleCourses1780800000000 implements MigrationInterface {
  name = 'BibleCourses1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "houses"
        ADD COLUMN "is_mother_house" boolean NOT NULL DEFAULT false
    `);

    // At most one house can be the mother house.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_houses_mother"
        ON "houses" ("is_mother_house")
        WHERE "is_mother_house" = true
    `);

    await queryRunner.query(`
      CREATE TABLE "bible_course_classes" (
        "id"         uuid       NOT NULL DEFAULT uuid_generate_v4(),
        "name"       varchar    NOT NULL,
        "house_id"   uuid       NOT NULL,
        "start_date" date       NOT NULL,
        "end_date"   date       NOT NULL,
        "status"     varchar    NOT NULL DEFAULT 'PLANNED',
        "notes"      text,
        "created_at" TIMESTAMP  NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP  NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_bible_course_classes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bible_course_classes_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "bible_course_enrollments" (
        "id"           uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "class_id"     uuid        NOT NULL,
        "resident_id"  uuid        NOT NULL,
        "status"       varchar     NOT NULL DEFAULT 'ENROLLED',
        "enrolled_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMPTZ,
        "notes"        text,
        "created_at"   TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bible_course_enrollments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bible_course_enrollments" UNIQUE ("class_id", "resident_id"),
        CONSTRAINT "FK_bible_course_enrollments_class"
          FOREIGN KEY ("class_id") REFERENCES "bible_course_classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bible_course_enrollments_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_enrollments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_classes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_houses_mother"`);
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN IF EXISTS "is_mother_house"`);
  }
}
