import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentPhotoThumbUrl1780600000000 implements MigrationInterface {
  name = 'ResidentPhotoThumbUrl1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" ADD "photo_thumb_url" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "photo_thumb_url"`);
  }
}
