import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppSettings1779997000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timer_reset_frequency VARCHAR NOT NULL DEFAULT 'DAILY',
        daily_usage_minutes INT NOT NULL DEFAULT 20,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO app_settings (timer_reset_frequency, daily_usage_minutes)
      VALUES ('DAILY', 20)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app_settings`);
  }
}
