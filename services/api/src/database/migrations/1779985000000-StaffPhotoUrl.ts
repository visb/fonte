import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffPhotoUrl1779985000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" ADD COLUMN "photo_url" varchar NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "photo_url"`);
  }
}
