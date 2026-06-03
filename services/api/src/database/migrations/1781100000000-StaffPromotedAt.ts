import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffPromotedAt1781100000000 implements MigrationInterface {
  name = 'StaffPromotedAt1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Data em que o filho foi promovido a servo. Null para servos criados direto.
    await queryRunner.query(
      `ALTER TABLE "staff" ADD COLUMN "promoted_at" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN IF EXISTS "promoted_at"`);
  }
}
