import { MigrationInterface, QueryRunner } from 'typeorm';

export class Incidents1778900000000 implements MigrationInterface {
  name = 'Incidents1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "incident_severity_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`);
    await queryRunner.query(`
      ALTER TABLE "incidents"
        ADD COLUMN "date"           date                     NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN "severity"       "incident_severity_enum" NOT NULL DEFAULT 'MEDIUM',
        ADD COLUMN "description"    text                     NOT NULL DEFAULT '',
        ADD COLUMN "house_id"       uuid                     NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        ADD COLUMN "responsible_id" uuid                     NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        ADD COLUMN "resident_id"    uuid
    `);
    await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "date" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "severity" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "description" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "house_id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "responsible_id" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "incidents"
        ADD CONSTRAINT "FK_incidents_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "FK_incidents_responsible"
          FOREIGN KEY ("responsible_id") REFERENCES "staff"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "FK_incidents_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidents"
        DROP CONSTRAINT IF EXISTS "FK_incidents_resident",
        DROP CONSTRAINT IF EXISTS "FK_incidents_responsible",
        DROP CONSTRAINT IF EXISTS "FK_incidents_house",
        DROP COLUMN "resident_id",
        DROP COLUMN "responsible_id",
        DROP COLUMN "house_id",
        DROP COLUMN "description",
        DROP COLUMN "severity",
        DROP COLUMN "date"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_severity_enum"`);
  }
}
