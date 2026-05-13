import { MigrationInterface, QueryRunner } from 'typeorm';

export class WishlistRejectionReason1779950000000 implements MigrationInterface {
  name = 'WishlistRejectionReason1779950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wishlist_items" ADD COLUMN "rejection_reason" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wishlist_items" DROP COLUMN "rejection_reason"
    `);
  }
}
