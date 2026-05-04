import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResidentAttachments1778500000000 implements MigrationInterface {
  name = 'ResidentAttachments1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "resident_attachments" (
        "id"           uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"  uuid        NOT NULL,
        "filename"     character varying NOT NULL,
        "file_url"     character varying NOT NULL,
        "created_at"   TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resident_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resident_attachments_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "resident_attachments"`);
  }
}
