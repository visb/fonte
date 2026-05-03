import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseSplitCapacity1778200000000 implements MigrationInterface {
  name = 'HouseSplitCapacity1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "houses" ADD "general_capacity" integer`);
    await queryRunner.query(`ALTER TABLE "houses" ADD "staff_capacity" integer`);
    await queryRunner.query(
      `UPDATE "houses" SET "general_capacity" = "capacity" WHERE "capacity" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "capacity"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "houses" ADD "capacity" integer`);
    await queryRunner.query(
      `UPDATE "houses" SET "capacity" = COALESCE("general_capacity", 0) + COALESCE("staff_capacity", 0)
       WHERE "general_capacity" IS NOT NULL OR "staff_capacity" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "staff_capacity"`);
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "general_capacity"`);
  }
}
