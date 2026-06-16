import { MigrationInterface, QueryRunner } from 'typeorm';

export class Payables1782800000000 implements MigrationInterface {
  name = 'Payables1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payables_category_enum" AS ENUM('UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'PAYROLL', 'TAXES', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payables_status_enum" AS ENUM('OPEN', 'PAID')`,
    );

    await queryRunner.query(`
      CREATE TABLE "payables" (
        "id"           UUID                                   NOT NULL DEFAULT uuid_generate_v4(),
        "description"  VARCHAR                                NOT NULL,
        "amount"       INTEGER                                NOT NULL,
        "due_date"     DATE                                   NOT NULL,
        "category"     "public"."payables_category_enum"      NOT NULL,
        "supplier"     VARCHAR,
        "status"       "public"."payables_status_enum"        NOT NULL DEFAULT 'OPEN',
        "paid_at"      DATE,
        "notes"        TEXT,
        "created_by"   UUID,
        "created_at"   TIMESTAMP                              NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP                              NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP,
        CONSTRAINT "PK_payables" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_payables_status" ON "payables" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payables_due_date" ON "payables" ("due_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_payables_due_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payables_status"`);
    await queryRunner.query(`DROP TABLE "payables"`);
    await queryRunner.query(`DROP TYPE "public"."payables_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payables_category_enum"`);
  }
}
