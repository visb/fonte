import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelativeResponsible1780009000000 implements MigrationInterface {
  name = 'RelativeResponsible1780009000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "relatives" ADD "is_responsible" boolean NOT NULL DEFAULT false`,
    );
    // Garante no máximo um responsável por acolhido.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_relatives_responsible_per_resident" ON "relatives" ("resident_id") WHERE "is_responsible" = true AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_relatives_responsible_per_resident"`);
    await queryRunner.query(`ALTER TABLE "relatives" DROP COLUMN "is_responsible"`);
  }
}
