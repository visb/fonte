import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseMinistryAndRules1778700000000 implements MigrationInterface {
  name = 'HouseMinistryAndRules1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "house_ministries" (
        "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "house_id"    uuid      NOT NULL,
        "ministry_id" uuid      NOT NULL,
        "leader_id"   uuid,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_house_ministries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_house_ministries_house_ministry" UNIQUE ("house_id", "ministry_id"),
        CONSTRAINT "FK_house_ministries_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_house_ministries_ministry"
          FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_house_ministries_leader"
          FOREIGN KEY ("leader_id") REFERENCES "staff"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "house_rules" (
        "id"         uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "house_id"   uuid      NOT NULL,
        "title"      varchar   NOT NULL,
        "content"    text      NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_house_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_house_rules_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "house_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "house_ministries"`);
  }
}
