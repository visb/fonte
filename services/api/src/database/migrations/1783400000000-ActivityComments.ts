import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityComments1783400000000 implements MigrationInterface {
  name = 'ActivityComments1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_comments" (
        "id"                  UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "activity_id"         UUID        NOT NULL,
        "body"                TEXT        NOT NULL,
        "created_by_user_id"  UUID        NOT NULL,
        "created_at"          TIMESTAMP   NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        CONSTRAINT "PK_activity_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activity_comments_activity"
          FOREIGN KEY ("activity_id") REFERENCES "activities" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_comments_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_activity_comments_activity_id" ON "activity_comments" ("activity_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_activity_comments_activity_id"`,
    );
    await queryRunner.query(`DROP TABLE "activity_comments"`);
  }
}
