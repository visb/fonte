import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseNewFields1778000000000 implements MigrationInterface {
  name = 'HouseNewFields1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "houses" ADD "address" character varying`);
    await queryRunner.query(`ALTER TABLE "houses" ADD "city" character varying`);
    await queryRunner.query(`ALTER TABLE "houses" ADD "state" character varying(2)`);
    await queryRunner.query(`ALTER TABLE "houses" ADD "coordinator_id" uuid`);
    await queryRunner.query(`ALTER TABLE "houses" ADD "phone" character varying`);
    await queryRunner.query(
      `ALTER TABLE "houses" ADD CONSTRAINT "FK_houses_coordinator"
       FOREIGN KEY ("coordinator_id") REFERENCES "staff"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "house_photos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "house_id" uuid NOT NULL,
        "filename" character varying NOT NULL,
        "path" character varying NOT NULL,
        "url" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_house_photos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_house_photos_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "house_photos"`);
    await queryRunner.query(
      `ALTER TABLE "houses" DROP CONSTRAINT "FK_houses_coordinator"`,
    );
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "coordinator_id"`);
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "state"`);
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "houses" DROP COLUMN "address"`);
  }
}
