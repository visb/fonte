import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayablePaymentReceipt1783100000000 implements MigrationInterface {
  name = 'PayablePaymentReceipt1783100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payables" ADD "payment_receipt_url" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables" ADD "payment_receipt_name" VARCHAR`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN "payment_receipt_name"`);
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN "payment_receipt_url"`);
  }
}
