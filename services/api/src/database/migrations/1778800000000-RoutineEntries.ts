import { MigrationInterface, QueryRunner } from 'typeorm';

export class RoutineEntries1778800000000 implements MigrationInterface {
  name = 'RoutineEntries1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "routine_entries"
        ADD COLUMN "date"           date NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN "description"    text NOT NULL DEFAULT '',
        ADD COLUMN "house_id"       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        ADD COLUMN "responsible_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        ADD COLUMN "resident_id"    uuid
    `);
    await queryRunner.query(`ALTER TABLE "routine_entries" ALTER COLUMN "date" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "routine_entries" ALTER COLUMN "description" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "routine_entries" ALTER COLUMN "house_id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "routine_entries" ALTER COLUMN "responsible_id" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "routine_entries"
        ADD CONSTRAINT "FK_routine_entries_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_routine_entries_responsible"
          FOREIGN KEY ("responsible_id") REFERENCES "staff"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "FK_routine_entries_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "routine_entries"
        DROP CONSTRAINT IF EXISTS "FK_routine_entries_resident",
        DROP CONSTRAINT IF EXISTS "FK_routine_entries_responsible",
        DROP CONSTRAINT IF EXISTS "FK_routine_entries_house",
        DROP COLUMN "resident_id",
        DROP COLUMN "responsible_id",
        DROP COLUMN "house_id",
        DROP COLUMN "description",
        DROP COLUMN "date"
    `);
  }
}
