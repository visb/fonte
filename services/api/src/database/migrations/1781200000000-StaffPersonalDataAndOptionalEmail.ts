import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffPersonalDataAndOptionalEmail1781200000000 implements MigrationInterface {
  name = 'StaffPersonalDataAndOptionalEmail1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nem todo servo tem acesso aos apps; e-mail deixa de ser obrigatório.
    // O índice único parcial (UQ_users_email_active) já permite múltiplos NULLs.
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);

    // Ficha pessoal do servo — espelha os dados pessoais do filho (resident).
    await queryRunner.query(
      `CREATE TYPE "public"."staff_gender_enum" AS ENUM('MALE', 'FEMALE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."staff_marital_status_enum" AS ENUM('SINGLE', 'MARRIED', 'DIVORCED')`,
    );

    await queryRunner.query(`ALTER TABLE "staff" ADD "birth_date" date`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "cpf" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "rg" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "nationality" character varying`);
    await queryRunner.query(
      `ALTER TABLE "staff" ADD "gender" "public"."staff_gender_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ADD "city" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "state" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "address" character varying`);
    await queryRunner.query(
      `ALTER TABLE "staff" ADD "marital_status" "public"."staff_marital_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD "children" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ADD "occupation" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "education" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "religion" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "addiction" character varying`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "health_issues" character varying`);
    await queryRunner.query(
      `ALTER TABLE "staff" ADD "continuous_medication" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "staff" ADD "weight" integer`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "height" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "height"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "weight"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "continuous_medication"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "health_issues"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "addiction"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "religion"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "education"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "occupation"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "children"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "marital_status"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "address"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "state"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "gender"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "nationality"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "rg"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "cpf"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN "birth_date"`);

    await queryRunner.query(`DROP TYPE "public"."staff_marital_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."staff_gender_enum"`);

    // Reverter e-mail para NOT NULL — pressupõe que não há linhas com email NULL.
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
  }
}
