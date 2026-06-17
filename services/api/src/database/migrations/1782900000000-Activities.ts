import { MigrationInterface, QueryRunner } from 'typeorm';

export class Activities1782900000000 implements MigrationInterface {
  name = 'Activities1782900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."activities_status_enum" AS ENUM('DRAFT', 'REQUESTED', 'TODO', 'DOING', 'BLOCKED', 'DONE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "activities" (
        "id"                    UUID                                   NOT NULL DEFAULT uuid_generate_v4(),
        "title"                 VARCHAR                                NOT NULL,
        "description"           TEXT,
        "status"                "public"."activities_status_enum"      NOT NULL DEFAULT 'DRAFT',
        "house_id"              UUID,
        "responsible_staff_id"  UUID,
        "created_by_user_id"    UUID                                   NOT NULL,
        "created_at"            TIMESTAMP                              NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMP                              NOT NULL DEFAULT now(),
        "deleted_at"            TIMESTAMP,
        CONSTRAINT "PK_activities" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activities_house"
          FOREIGN KEY ("house_id") REFERENCES "houses" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_activities_responsible"
          FOREIGN KEY ("responsible_staff_id") REFERENCES "staff" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_activities_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_activities_house_id" ON "activities" ("house_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_status" ON "activities" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_responsible_staff_id" ON "activities" ("responsible_staff_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_activities_responsible_staff_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_activities_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_activities_house_id"`);
    await queryRunner.query(`DROP TABLE "activities"`);
    await queryRunner.query(`DROP TYPE "public"."activities_status_enum"`);
  }
}
