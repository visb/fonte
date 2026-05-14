import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffSupportGroupId1779980000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "staff"
      ADD COLUMN "support_group_id" uuid NULL
        REFERENCES "support_groups"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "support_group_id"`);
  }
}
