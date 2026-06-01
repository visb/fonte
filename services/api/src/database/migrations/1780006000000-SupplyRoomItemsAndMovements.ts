import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplyRoomItemsAndMovements1780006000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE supply_room_category_enum AS ENUM (
        'CLEANING',
        'HYGIENE',
        'PPE',
        'OFFICE',
        'OTHER'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE supply_room_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        unit VARCHAR NOT NULL,
        category supply_room_category_enum NOT NULL,
        house_id UUID NOT NULL REFERENCES houses(id),
        current_quantity NUMERIC(10, 3) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE supply_room_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES supply_room_items(id),
        type movement_type_enum NOT NULL,
        quantity NUMERIC(10, 3) NOT NULL,
        responsible_id UUID NOT NULL REFERENCES staff(id),
        notes TEXT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE supply_room_movements`);
    await queryRunner.query(`DROP TABLE supply_room_items`);
    await queryRunner.query(`DROP TYPE supply_room_category_enum`);
  }
}
