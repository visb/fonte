import { MigrationInterface, QueryRunner } from 'typeorm';

export class FollowUpAttachment1780003000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resident_follow_ups
        ADD COLUMN attachment_url varchar NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resident_follow_ups
        DROP COLUMN attachment_url
    `);
  }
}
