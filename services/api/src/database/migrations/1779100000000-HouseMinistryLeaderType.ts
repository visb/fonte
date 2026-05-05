import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseMinistryLeaderType1779100000000 implements MigrationInterface {
  name = 'HouseMinistryLeaderType1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "house_ministries"
        DROP CONSTRAINT "FK_house_ministries_leader"
    `);

    await queryRunner.query(`
      ALTER TABLE "house_ministries"
        ADD COLUMN "leader_type" VARCHAR(10) NULL
    `);

    await queryRunner.query(`
      UPDATE "house_ministries"
        SET "leader_type" = 'STAFF'
        WHERE "leader_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "house_ministries"
        DROP COLUMN "leader_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "house_ministries"
        ADD CONSTRAINT "FK_house_ministries_leader"
          FOREIGN KEY ("leader_id") REFERENCES "staff"("id") ON DELETE SET NULL
    `);
  }
}
