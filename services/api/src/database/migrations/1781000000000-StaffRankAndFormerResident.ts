import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffRankAndFormerResident1781000000000 implements MigrationInterface {
  name = 'StaffRankAndFormerResident1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nível espiritual do servo (SERVANT). Nullable: ADMIN/COORDINATOR ficam sem rank.
    await queryRunner.query(
      `CREATE TYPE "public"."staff_rank_enum" AS ENUM ('ASPIRANTE', 'CONSAGRADO', 'ALIANCADO')`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD COLUMN "rank" "public"."staff_rank_enum"`,
    );

    // Vínculo histórico: este servo foi um filho (acolhido) antes.
    await queryRunner.query(
      `ALTER TABLE "staff" ADD COLUMN "former_resident_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "FK_staff_former_resident"
        FOREIGN KEY ("former_resident_id") REFERENCES "residents"("id") ON DELETE SET NULL`,
    );

    // Novo tipo de evento na timeline do filho ao ser promovido a servo.
    await queryRunner.query(
      `ALTER TYPE "follow_up_type_enum" ADD VALUE IF NOT EXISTS 'PROMOTED_TO_SERVANT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres não suporta remover valor de enum; PROMOTED_TO_SERVANT permanece em follow_up_type_enum.
    await queryRunner.query(
      `ALTER TABLE "staff" DROP CONSTRAINT IF EXISTS "FK_staff_former_resident"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN IF EXISTS "former_resident_id"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP COLUMN IF EXISTS "rank"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."staff_rank_enum"`);
  }
}
