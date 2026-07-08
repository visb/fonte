import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 112 — contribuição em produtos na declaração da parcela.
 *
 * Cria `receivable_product_contributions`: uma linha por produto declarado numa
 * parcela do carnê (`resident_receivables`). Modo catálogo referencia o catálogo
 * unificado ([[111]], `inventory_items`) e vincula o movimento IN gerado
 * (`inventory_movements`); modo avulso guarda só a descrição livre.
 */
export class ReceivableProductContributions1784800000000 implements MigrationInterface {
  name = 'ReceivableProductContributions1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "receivable_product_contributions" (
        "id"                    uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "receivable_id"         uuid          NOT NULL,
        "inventory_item_id"     uuid,
        "inventory_movement_id" uuid,
        "description"           text,
        "quantity"              numeric(10,3),
        "unit"                  varchar,
        "pending_detailing"     boolean       NOT NULL DEFAULT false,
        "created_by_id"         uuid,
        "created_at"            TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMP     NOT NULL DEFAULT now(),
        "deleted_at"            TIMESTAMP,
        CONSTRAINT "PK_receivable_product_contributions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rpc_receivable"
          FOREIGN KEY ("receivable_id") REFERENCES "resident_receivables"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rpc_inventory_item"
          FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_rpc_inventory_movement"
          FOREIGN KEY ("inventory_movement_id") REFERENCES "inventory_movements"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_rpc_created_by"
          FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_rpc_item_xor_description"
          CHECK (("inventory_item_id" IS NOT NULL) <> ("description" IS NOT NULL))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rpc_receivable" ON "receivable_product_contributions" ("receivable_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_rpc_inventory_item" ON "receivable_product_contributions" ("inventory_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rpc_inventory_item"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rpc_receivable"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "receivable_product_contributions"`);
  }
}
