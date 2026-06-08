import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocumentTemplateSignAtAdmission1781900000000 implements MigrationInterface {
  name = 'DocumentTemplateSignAtAdmission1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_templates" ADD COLUMN "sign_at_admission" BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document_templates" DROP COLUMN "sign_at_admission"`);
  }
}
