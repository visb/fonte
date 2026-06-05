import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReceivablePaidAmountModality1781400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resident_receivables"
        ADD COLUMN "paid_amount" integer NULL,
        ADD COLUMN "paid_family_investment" "family_investment_enum" NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resident_receivables"
        DROP COLUMN "paid_family_investment",
        DROP COLUMN "paid_amount"
    `);
  }
}
