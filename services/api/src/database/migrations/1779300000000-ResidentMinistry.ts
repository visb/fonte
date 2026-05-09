import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentMinistry1779300000000 implements MigrationInterface {
  name = 'ResidentMinistry1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "residents"
        ADD COLUMN "ministry_id" uuid,
        ADD CONSTRAINT "FK_residents_ministry"
          FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "residents"
        DROP CONSTRAINT "FK_residents_ministry",
        DROP COLUMN "ministry_id"
    `);
  }
}
