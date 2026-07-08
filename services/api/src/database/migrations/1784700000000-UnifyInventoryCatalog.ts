import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 111 — Unifica almoxarifado (`storeroom_items`/`storeroom_movements`) e
 * dispensa (`supply_room_items`/`supply_room_movements`) num catálogo único
 * (`inventory_items`/`inventory_movements`) com discriminador `kind`.
 *
 * - Cria as tabelas unificadas + enum `inventory_kind_enum` + índices equivalentes.
 * - Backfill copiando itens e movimentos dos dois inventários PRESERVANDO os ids
 *   (não quebra FKs/histórico) e populando `kind`.
 * - As tabelas antigas permanecem no lugar (drop físico fica para migration
 *   posterior, após validação) — reduz o risco de rollback.
 */
export class UnifyInventoryCatalog1784700000000 implements MigrationInterface {
  name = 'UnifyInventoryCatalog1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "inventory_kind_enum" AS ENUM ('STOREROOM', 'SUPPLY_ROOM')
    `);

    await queryRunner.query(`
      CREATE TABLE "inventory_items" (
        "id"                           uuid                        NOT NULL DEFAULT uuid_generate_v4(),
        "kind"                         "inventory_kind_enum"       NOT NULL,
        "name"                         varchar                     NOT NULL,
        "unit"                         varchar                     NOT NULL,
        "house_id"                     uuid                        NOT NULL,
        "current_quantity"             numeric(10,3)               NOT NULL DEFAULT 0,
        "weekly_average_usage"         numeric(10,3)               NOT NULL DEFAULT 0,
        "weekly_average_calculated_at" TIMESTAMP,
        "weekly_average_window_start"  date,
        "weekly_average_window_end"    date,
        "category"                     "supply_room_category_enum",
        "created_at"                   TIMESTAMP                   NOT NULL DEFAULT now(),
        "updated_at"                   TIMESTAMP                   NOT NULL DEFAULT now(),
        "deleted_at"                   TIMESTAMP,
        CONSTRAINT "PK_inventory_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_items_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_inventory_items_weekly_average_usage_non_negative"
          CHECK ("weekly_average_usage" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "inventory_movements" (
        "id"             uuid                    NOT NULL DEFAULT uuid_generate_v4(),
        "kind"           "inventory_kind_enum"   NOT NULL,
        "item_id"        uuid                    NOT NULL,
        "type"           "movement_type_enum"    NOT NULL,
        "quantity"       numeric(10,3)           NOT NULL,
        "responsible_id" uuid                    NOT NULL,
        "notes"          text,
        "date"           date                    NOT NULL,
        "created_at"     TIMESTAMP               NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP               NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_movements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_movements_item"
          FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_movements_responsible"
          FOREIGN KEY ("responsible_id") REFERENCES "staff"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_items_kind" ON "inventory_items" ("kind")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_items_kind_house" ON "inventory_items" ("kind", "house_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_movements_kind" ON "inventory_movements" ("kind")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_movements_type_date_item"
        ON "inventory_movements" ("type", "date", "item_id")
    `);

    // ── Backfill: almoxarifado (STOREROOM) ──────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "inventory_items" (
        "id", "kind", "name", "unit", "house_id", "current_quantity",
        "weekly_average_usage", "weekly_average_calculated_at",
        "weekly_average_window_start", "weekly_average_window_end",
        "category", "created_at", "updated_at", "deleted_at"
      )
      SELECT
        "id", 'STOREROOM', "name", "unit", "house_id", "current_quantity",
        "weekly_average_usage", "weekly_average_calculated_at",
        "weekly_average_window_start", "weekly_average_window_end",
        NULL, "created_at", "updated_at", "deleted_at"
      FROM "storeroom_items"
    `);

    await queryRunner.query(`
      INSERT INTO "inventory_movements" (
        "id", "kind", "item_id", "type", "quantity", "responsible_id",
        "notes", "date", "created_at", "updated_at"
      )
      SELECT
        "id", 'STOREROOM', "item_id", "type", "quantity", "responsible_id",
        "notes", "date", "created_at", "updated_at"
      FROM "storeroom_movements"
    `);

    // ── Backfill: dispensa (SUPPLY_ROOM) ────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "inventory_items" (
        "id", "kind", "name", "unit", "house_id", "current_quantity",
        "weekly_average_usage", "weekly_average_calculated_at",
        "weekly_average_window_start", "weekly_average_window_end",
        "category", "created_at", "updated_at", "deleted_at"
      )
      SELECT
        "id", 'SUPPLY_ROOM', "name", "unit", "house_id", "current_quantity",
        0, NULL, NULL, NULL,
        "category", "created_at", "updated_at", "deleted_at"
      FROM "supply_room_items"
    `);

    await queryRunner.query(`
      INSERT INTO "inventory_movements" (
        "id", "kind", "item_id", "type", "quantity", "responsible_id",
        "notes", "date", "created_at", "updated_at"
      )
      SELECT
        "id", 'SUPPLY_ROOM', "item_id", "type", "quantity", "responsible_id",
        "notes", "date", "created_at", "updated_at"
      FROM "supply_room_movements"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_movements_type_date_item"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_movements_kind"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_items_kind_house"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_items_kind"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "inventory_kind_enum"`);
  }
}
