import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoreroomItemsAndMovements1779000000000 implements MigrationInterface {
  name = 'StoreroomItemsAndMovements1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "storerooms"`);
    await queryRunner.query(`CREATE TYPE "movement_type_enum" AS ENUM ('IN', 'OUT')`);
    await queryRunner.query(`
      CREATE TABLE "storeroom_items" (
        "id"               uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "name"             varchar       NOT NULL,
        "unit"             varchar       NOT NULL,
        "house_id"         uuid          NOT NULL,
        "current_quantity" numeric(10,3) NOT NULL DEFAULT 0,
        "created_at"       TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP     NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMP,
        CONSTRAINT "PK_storeroom_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_storeroom_items_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "storeroom_movements" (
        "id"             uuid                 NOT NULL DEFAULT uuid_generate_v4(),
        "item_id"        uuid                 NOT NULL,
        "type"           "movement_type_enum" NOT NULL,
        "quantity"       numeric(10,3)        NOT NULL,
        "responsible_id" uuid                 NOT NULL,
        "notes"          text,
        "date"           date                 NOT NULL,
        "created_at"     TIMESTAMP            NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP            NOT NULL DEFAULT now(),
        CONSTRAINT "PK_storeroom_movements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_storeroom_movements_item"
          FOREIGN KEY ("item_id") REFERENCES "storeroom_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_storeroom_movements_responsible"
          FOREIGN KEY ("responsible_id") REFERENCES "staff"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "storeroom_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "storeroom_items"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "movement_type_enum"`);
  }
}
