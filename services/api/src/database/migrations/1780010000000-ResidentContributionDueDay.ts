import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentContributionDueDay1780010000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "residents" ADD COLUMN "contribution_due_day" integer`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "residents" DROP COLUMN "contribution_due_day"`,
    );
  }
}
