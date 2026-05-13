import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wishlist1779900000000 implements MigrationInterface {
  name = 'Wishlist1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."wishlist_items_status_enum" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')
    `);
    await queryRunner.query(`
      CREATE TABLE "wishlist_items" (
        "id"                   UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"          UUID        NOT NULL,
        "description"          VARCHAR     NOT NULL,
        "quantity"             INTEGER     NOT NULL DEFAULT 1,
        "status"               "public"."wishlist_items_status_enum" NOT NULL DEFAULT 'PENDING_APPROVAL',
        "is_removal_requested" BOOLEAN     NOT NULL DEFAULT false,
        "created_by_user_id"   UUID        NOT NULL,
        "approved_by_user_id"  UUID        NULL,
        "approved_at"          TIMESTAMP   NULL,
        "created_at"           TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP   NOT NULL DEFAULT now(),
        "deleted_at"           TIMESTAMP   NULL,
        CONSTRAINT "PK_wishlist_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wishlist_items_resident" FOREIGN KEY ("resident_id")
          REFERENCES "residents"("id"),
        CONSTRAINT "FK_wishlist_items_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wishlist_items"`);
    await queryRunner.query(`DROP TYPE "public"."wishlist_items_status_enum"`);
  }
}
