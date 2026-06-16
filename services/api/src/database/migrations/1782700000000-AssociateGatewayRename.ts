import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 41 — troca de gateway (AbacatePay → Pagar.me). Renomeia as colunas de id
 * do gateway para nomes GENÉRICOS (`gateway_*`), desacoplados do nome do provedor,
 * à prova de troca futura. Renomeia também o índice único de idempotência.
 *
 * Não altera as migrations anteriores (1782500000000 / 1782600000000); só renomeia.
 */
export class AssociateGatewayRename1782700000000 implements MigrationInterface {
  name = 'AssociateGatewayRename1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "associates" RENAME COLUMN "abacatepay_customer_id" TO "gateway_customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "associate_subscriptions" RENAME COLUMN "abacatepay_subscription_id" TO "gateway_subscription_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "associate_charges" RENAME COLUMN "abacatepay_charge_id" TO "gateway_charge_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_associate_charges_abacatepay_charge_id" RENAME TO "UQ_associate_charges_gateway_charge_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "UQ_associate_charges_gateway_charge_id" RENAME TO "UQ_associate_charges_abacatepay_charge_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "associate_charges" RENAME COLUMN "gateway_charge_id" TO "abacatepay_charge_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "associate_subscriptions" RENAME COLUMN "gateway_subscription_id" TO "abacatepay_subscription_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "associates" RENAME COLUMN "gateway_customer_id" TO "abacatepay_customer_id"`,
    );
  }
}
