import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsentRecords1782000000000 implements MigrationInterface {
  name = 'ConsentRecords1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "consent_records" (
        "id"                   UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "subject_type"         VARCHAR     NOT NULL,
        "subject_id"           UUID        NOT NULL,
        "purpose"              VARCHAR     NOT NULL,
        "granted"              BOOLEAN     NOT NULL,
        "term_version"         VARCHAR     NULL,
        "recorded_by_user_id"  UUID        NULL,
        "created_at"           TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consent_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_consent_records_subject" ON "consent_records" ("subject_type", "subject_id", "purpose")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "consent_records"`);
  }
}
