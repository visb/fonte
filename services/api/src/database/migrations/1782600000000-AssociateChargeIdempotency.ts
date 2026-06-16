import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 38 — idempotência do webhook AbacatePay no nível do banco.
 * Índice único parcial sobre `abacatepay_charge_id` (ignora NULLs, pois a 1ª
 * cobrança nasce sem id do gateway até o webhook chegar). Garante que o mesmo
 * `abacatepay_charge_id` nunca gere duas linhas mesmo sob entregas concorrentes.
 */
export class AssociateChargeIdempotency1782600000000 implements MigrationInterface {
  name = 'AssociateChargeIdempotency1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_associate_charges_abacatepay_charge_id"
      ON "associate_charges" ("abacatepay_charge_id")
      WHERE "abacatepay_charge_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_associate_charges_abacatepay_charge_id"`,
    );
  }
}
