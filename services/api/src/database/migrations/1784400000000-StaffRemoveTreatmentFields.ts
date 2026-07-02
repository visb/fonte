import { MigrationInterface, QueryRunner } from 'typeorm';

// Story 96 — remove de vez os campos clínicos/de tratamento do servo (Staff).
// Eles espelhavam a ficha do acolhido (Resident) e davam a impressão de
// "ficha de tratamento", o que não faz sentido para um servo. Limpeza
// definitiva: as colunas são dropadas (não apenas escondidas no form).
export class StaffRemoveTreatmentFields1784400000000 implements MigrationInterface {
  name = 'StaffRemoveTreatmentFields1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "height"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "weight"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "continuous_medication"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "health_issues"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "addiction"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" ADD "addiction" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "health_issues" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "continuous_medication" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "weight" integer`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "height" integer`);
  }
}
