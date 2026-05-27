import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUsersEmailConstraint1780004000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // The original TypeORM-generated constraint name that was not removed by
    // the Admissions migration (which tried to drop "UQ_users_email" — wrong name).
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3"
    `);

    // Ensure the partial unique index from the Admissions migration exists.
    // If it was already created this is a no-op; if somehow it's missing, recreate it.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_active"
        ON "users"("email")
        WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email_active"`);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")
    `);
  }
}
