import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayableAttachment1783000000000 implements MigrationInterface {
  name = 'PayableAttachment1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payables" ADD "attachment_url" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" ADD "attachment_name" VARCHAR`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN "attachment_name"`);
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN "attachment_url"`);
  }
}
