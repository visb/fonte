import { MigrationInterface, QueryRunner } from 'typeorm';

// LGPD art. 16 — soft delete em entidades com dado pessoal que ainda não o
// tinham, permitindo retenção controlada e descarte/anonimização posteriores.
export class SoftDeleteRetention1782100000000 implements MigrationInterface {
  name = 'SoftDeleteRetention1782100000000';

  private readonly tables = [
    'admissions',
    'messages',
    'bible_course_enrollments',
    'resident_usage_sessions',
    'support_group_checkins',
    'support_group_relative_checkins',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "deleted_at" TIMESTAMP NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "deleted_at"`);
    }
  }
}
