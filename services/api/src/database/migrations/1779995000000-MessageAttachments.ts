import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageAttachments1779995000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "content" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN "attachment_url" text`);
    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN "attachment_type" varchar(10)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "attachment_type"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "attachment_url"`);
    await queryRunner.query(`UPDATE "messages" SET "content" = '' WHERE "content" IS NULL`);
    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "content" SET NOT NULL`);
  }
}
