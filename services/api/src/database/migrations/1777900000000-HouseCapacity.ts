import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseCapacity1777900000000 implements MigrationInterface {
  name = 'HouseCapacity1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "houses" ADD "capacity" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "capacity"`);
  }
}
