import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentNationality1780007000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" ADD COLUMN "nationality" varchar`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "nationality"`);
  }
}
