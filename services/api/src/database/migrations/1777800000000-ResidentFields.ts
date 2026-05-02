import { MigrationInterface, QueryRunner } from "typeorm";

export class ResidentFields1777800000000 implements MigrationInterface {
  name = "ResidentFields1777800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."residents_gender_enum" AS ENUM('MALE', 'FEMALE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."residents_marital_status_enum" AS ENUM('SINGLE', 'MARRIED', 'DIVORCED')`,
    );

    await queryRunner.query(
      `ALTER TABLE "residents" ADD "gender" "public"."residents_gender_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "rg" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "address" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "contact_phone" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "marital_status" "public"."residents_marital_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "children" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "occupation" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "residents" ADD "guardian_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "education" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "health_issues" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "continuous_medication" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "religion" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "addiction" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "residents" ADD "weight" integer`);
    await queryRunner.query(`ALTER TABLE "residents" ADD "height" integer`);
    await queryRunner.query(
      `ALTER TABLE "residents" ADD "family_investment" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "residents" ADD CONSTRAINT "FK_residents_guardian" FOREIGN KEY ("guardian_id") REFERENCES "relatives"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "residents" DROP CONSTRAINT "FK_residents_guardian"`,
    );

    await queryRunner.query(
      `ALTER TABLE "residents" DROP COLUMN "family_investment"`,
    );
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "height"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "weight"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "addiction"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "religion"`);
    await queryRunner.query(
      `ALTER TABLE "residents" DROP COLUMN "continuous_medication"`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" DROP COLUMN "health_issues"`,
    );
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "education"`);
    await queryRunner.query(
      `ALTER TABLE "residents" DROP COLUMN "guardian_id"`,
    );
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "occupation"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "children"`);
    await queryRunner.query(
      `ALTER TABLE "residents" DROP COLUMN "marital_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" DROP COLUMN "contact_phone"`,
    );
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "address"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "rg"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN "gender"`);
    await queryRunner.query(
      `DROP TYPE "public"."residents_marital_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."residents_gender_enum"`);
  }
}
