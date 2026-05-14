import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelativePhotoUrl1779990000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "relatives" ADD COLUMN "photo_url" varchar NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "relatives" DROP COLUMN "photo_url"`);
  }
}
