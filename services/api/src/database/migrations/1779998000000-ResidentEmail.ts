import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentEmail1779998000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE residents
        ADD COLUMN email VARCHAR NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE residents
        DROP COLUMN email
    `);
  }
}
