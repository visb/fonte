import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectMessages1779970000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        ALTER COLUMN resident_id DROP NOT NULL,
        ADD COLUMN staff_id UUID REFERENCES staff(id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN staff_id`);
    await queryRunner.query(`ALTER TABLE messages ALTER COLUMN resident_id SET NOT NULL`);
  }
}
