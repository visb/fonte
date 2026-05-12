import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffHouseNullable1779600000000 implements MigrationInterface {
  name = 'StaffHouseNullable1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "staff"
        ALTER COLUMN "house_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "staff" SET "house_id" = (SELECT id FROM houses LIMIT 1) WHERE "house_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "staff"
        ALTER COLUMN "house_id" SET NOT NULL
    `);
  }
}
