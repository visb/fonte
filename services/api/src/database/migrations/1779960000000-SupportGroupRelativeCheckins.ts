import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupportGroupRelativeCheckins1779960000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE support_group_relative_checkins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id UUID NOT NULL REFERENCES support_group_meetings(id) ON DELETE CASCADE,
        relative_id UUID NOT NULL,
        checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(meeting_id, relative_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE support_group_relative_checkins`);
  }
}
