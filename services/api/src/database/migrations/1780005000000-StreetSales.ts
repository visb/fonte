import { MigrationInterface, QueryRunner } from 'typeorm';

export class StreetSales1780005000000 implements MigrationInterface {
  name = 'StreetSales1780005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."street_sales_type_enum" AS ENUM('BREAD', 'PIZZA')`);

    await queryRunner.query(`
      CREATE TABLE "street_sales" (
        "id"             UUID                              NOT NULL DEFAULT uuid_generate_v4(),
        "house_id"       UUID                              NOT NULL,
        "registered_by"  UUID,
        "date"           DATE                              NOT NULL,
        "type"           "public"."street_sales_type_enum" NOT NULL,
        "quantity"       INTEGER                           NOT NULL,
        "amount_pix"     INTEGER                           NOT NULL DEFAULT 0,
        "amount_cash"    INTEGER                           NOT NULL DEFAULT 0,
        "amount_card"    INTEGER                           NOT NULL DEFAULT 0,
        "created_at"     TIMESTAMP                         NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP                         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_street_sales" PRIMARY KEY ("id"),
        CONSTRAINT "FK_street_sales_house"    FOREIGN KEY ("house_id")      REFERENCES "houses"("id"),
        CONSTRAINT "FK_street_sales_staff"    FOREIGN KEY ("registered_by") REFERENCES "staff"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "street_sales"`);
    await queryRunner.query(`DROP TYPE "public"."street_sales_type_enum"`);
  }
}
