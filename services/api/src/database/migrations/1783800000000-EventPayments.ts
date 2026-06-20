import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 69 — pagamento avulso da inscrição em evento.
 * Adiciona à `events`:
 *   - `payment_enabled` boolean NOT NULL DEFAULT false — cobrança da inscrição
 *     habilitada (false = inscrição grátis, fluxo da story 58);
 *   - `price_cents` integer NULL — preço líquido em centavos (obrigatório quando
 *     payment_enabled = true; validado no service).
 * Adiciona à `event_registrations`:
 *   - `payment_token` varchar NULL UNIQUE — token p/ a página pública de pagamento;
 *   - `payment_status` varchar NOT NULL DEFAULT 'NONE'
 *     ('NONE' grátis | 'PENDING' | 'PAID' | 'FAILED');
 *   - `amount_cents` integer NULL — valor gross-up cobrado (snapshot na inscrição);
 *   - `gateway_order_id` / `gateway_charge_id` varchar NULL (genéricos, padrão [[41]]);
 *   - `payment_method` varchar NULL ('credit_card' | 'pix').
 * Índice único parcial por `gateway_charge_id` p/ idempotência do webhook (padrão
 * [[38]]/[[41]]).
 *
 * Aditiva, sem drop destrutivo. IF NOT EXISTS/IF EXISTS deixam idempotente.
 *
 * Timestamp 1783800000000: roda DEPOIS de Events1783200000000,
 * EventRegistrations1783300000000 e da última migration existente
 * (EventRegistrationFields1783700000000).
 */
export class EventPayments1783800000000 implements MigrationInterface {
  name = 'EventPayments1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "payment_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "price_cents" integer`,
    );

    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "payment_token" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "payment_status" varchar NOT NULL DEFAULT 'NONE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "amount_cents" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "gateway_order_id" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "gateway_charge_id" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "payment_method" varchar`,
    );

    // Token único (parcial: só linhas que têm token).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_event_registrations_payment_token"
       ON "event_registrations" ("payment_token") WHERE "payment_token" IS NOT NULL`,
    );
    // Idempotência do webhook por charge do gateway.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_event_registrations_gateway_charge_id"
       ON "event_registrations" ("gateway_charge_id") WHERE "gateway_charge_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_event_registrations_gateway_charge_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_event_registrations_payment_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "payment_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "gateway_charge_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "gateway_order_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "amount_cents"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "payment_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "payment_token"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "price_cents"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN IF EXISTS "payment_enabled"`,
    );
  }
}
