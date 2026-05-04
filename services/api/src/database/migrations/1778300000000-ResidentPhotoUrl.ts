import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentPhotoUrl1778300000000 implements MigrationInterface {
  name = 'ResidentPhotoUrl1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" ADD "photo_url" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "photo_url"`);
  }
}
