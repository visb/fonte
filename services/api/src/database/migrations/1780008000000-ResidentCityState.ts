import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentCityState1780008000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" ADD COLUMN "city" varchar`);
    await queryRunner.query(`ALTER TABLE "residents" ADD COLUMN "state" varchar`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "state"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "city"`);
  }
}
